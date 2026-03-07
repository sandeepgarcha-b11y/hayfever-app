import { NextRequest, NextResponse } from "next/server";
import { buildRecommendation } from "@/lib/recommendations";
import type { WeatherData, PollenData, ConditionsResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");

  if (!lat || !lon) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required" },
      { status: 400 }
    );
  }

  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  if (isNaN(latNum) || isNaN(lonNum)) {
    return NextResponse.json(
      { error: "lat and lon must be valid numbers" },
      { status: 400 }
    );
  }

  try {
    const [weatherRes, pollenRes, geoRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,precipitation_probability,is_day` +
          `&timezone=auto`
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latNum}&longitude=${lonNum}` +
          `&current=grass_pollen,tree_pollen,weed_pollen` +
          `&timezone=auto`
      ),
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lonNum}&format=json`,
        { headers: { "User-Agent": "hayfever-app/1.0" } }
      ),
    ]);

    if (!weatherRes.ok) {
      throw new Error(`Weather API error: ${weatherRes.status}`);
    }
    if (!pollenRes.ok) {
      throw new Error(`Pollen API error: ${pollenRes.status}`);
    }

    const weatherJson = await weatherRes.json();
    const pollenJson = await pollenRes.json();
    const geoJson = geoRes.ok ? await geoRes.json() : null;

    const c = weatherJson.current;
    const weather: WeatherData = {
      temperature: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      uvIndex: Math.round(c.uv_index ?? 0),
      windSpeed: Math.round(c.wind_speed_10m),
      windDirection: c.wind_direction_10m,
      precipitationProbability: c.precipitation_probability ?? 0,
      weatherCode: c.weather_code,
      isDay: c.is_day,
    };

    const p = pollenJson.current;
    const pollen: PollenData = {
      grassPollen: p.grass_pollen ?? null,
      treePollen: p.tree_pollen ?? null,
      weedPollen: p.weed_pollen ?? null,
    };

    const recommendation = buildRecommendation(weather, pollen);

    // Build a readable location name from reverse geocoding
    let locationName = `${latNum.toFixed(2)}, ${lonNum.toFixed(2)}`;
    if (geoJson?.address) {
      const a = geoJson.address;
      const parts = [
        a.city || a.town || a.village || a.hamlet || a.suburb,
        a.state || a.county,
        a.country,
      ].filter(Boolean);
      if (parts.length) locationName = parts.join(", ");
    }

    const response: ConditionsResponse = {
      weather,
      pollen,
      recommendation,
      locationName,
      fetchedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=300" },
    });
  } catch (err) {
    console.error("Conditions API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conditions data" },
      { status: 500 }
    );
  }
}
