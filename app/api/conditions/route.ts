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
    // Fetch weather and geocoding in parallel; pollen handled separately so its
    // failure doesn't take down the whole response.
    const [weatherRes, geoRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,precipitation_probability,is_day` +
          `&timezone=auto`
      ),
      fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latNum}&lon=${lonNum}&format=json`,
        { headers: { "User-Agent": "hayfever-app/1.0" } }
      ),
    ]);

    if (!weatherRes.ok) {
      const body = await weatherRes.text();
      console.error(`Weather API error ${weatherRes.status}:`, body);
      throw new Error(`Weather API error: ${weatherRes.status}`);
    }

    const weatherJson = await weatherRes.json();
    const c = weatherJson.current;

    if (!c) {
      console.error("Weather API returned no current data:", JSON.stringify(weatherJson));
      throw new Error("Weather API returned no current data");
    }

    const weather: WeatherData = {
      temperature: Math.round(c.temperature_2m ?? 0),
      feelsLike: Math.round(c.apparent_temperature ?? 0),
      uvIndex: Math.round(c.uv_index ?? 0),
      windSpeed: Math.round(c.wind_speed_10m ?? 0),
      windDirection: c.wind_direction_10m ?? 0,
      precipitationProbability: c.precipitation_probability ?? 0,
      weatherCode: c.weather_code ?? 0,
      isDay: c.is_day ?? 1,
    };

    // Pollen is best-effort — if the API is unavailable for a region, fall back to nulls
    let pollen: PollenData = { grassPollen: null, treePollen: null, weedPollen: null };
    try {
      // Open-Meteo uses species-level pollen variables, not aggregated tree/weed.
      // We fetch all species and aggregate into grass / tree / weed for display.
      const pollenRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latNum}&longitude=${lonNum}` +
          `&current=grass_pollen,alder_pollen,birch_pollen,olive_pollen,mugwort_pollen,ragweed_pollen` +
          `&timezone=auto`
      );
      if (pollenRes.ok) {
        const pollenJson = await pollenRes.json();
        const p = pollenJson.current;
        if (p) {
          // Use the highest reading within each category as the representative value
          const maxOf = (...vals: (number | null | undefined)[]): number | null => {
            const nums = vals.filter((v): v is number => v != null && !isNaN(v));
            return nums.length ? Math.max(...nums) : null;
          };
          pollen = {
            grassPollen: p.grass_pollen ?? null,
            treePollen: maxOf(p.alder_pollen, p.birch_pollen, p.olive_pollen),
            weedPollen: maxOf(p.mugwort_pollen, p.ragweed_pollen),
          };
        } else {
          console.warn("Pollen API returned no current data — using nulls");
        }
      } else {
        const body = await pollenRes.text();
        console.warn(`Pollen API ${pollenRes.status} — using nulls:`, body);
      }
    } catch (pollenErr) {
      console.warn("Pollen API fetch failed — using nulls:", pollenErr);
    }

    const recommendation = buildRecommendation(weather, pollen);

    // Build a readable location name from reverse geocoding
    const geoJson = geoRes.ok ? await geoRes.json().catch(() => null) : null;
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
