import { NextRequest, NextResponse } from "next/server";
import { buildRecommendation } from "@/lib/recommendations";
import type { WeatherData, PollenData, ConditionsResponse, DailyForecast } from "@/lib/types";

const maxOf = (...vals: (number | null | undefined)[]): number | null => {
  const nums = vals.filter((v): v is number => v != null && !isNaN(v));
  return nums.length ? Math.max(...nums) : null;
};

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
    const [weatherRes, geoRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latNum}&longitude=${lonNum}` +
          `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,uv_index,precipitation_probability,is_day` +
          `&daily=temperature_2m_max,weather_code,precipitation_probability_max` +
          `&forecast_days=7&timezone=auto`
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

    // Pollen is best-effort — if unavailable for a region, fall back to nulls
    let pollen: PollenData = { grassPollen: null, treePollen: null, weedPollen: null };
    const weeklyPollenByDate: Record<string, { grass: number[]; tree: number[]; weed: number[] }> = {};

    try {
      const pollenRes = await fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latNum}&longitude=${lonNum}` +
          `&current=grass_pollen,alder_pollen,birch_pollen,olive_pollen,mugwort_pollen,ragweed_pollen` +
          `&hourly=grass_pollen,alder_pollen,birch_pollen,olive_pollen,mugwort_pollen,ragweed_pollen` +
          `&forecast_days=7&timezone=auto`
      );

      if (pollenRes.ok) {
        const pollenJson = await pollenRes.json();

        // Current pollen (for today's cards)
        const p = pollenJson.current;
        if (p) {
          pollen = {
            grassPollen: p.grass_pollen ?? null,
            treePollen: maxOf(p.alder_pollen, p.birch_pollen, p.olive_pollen),
            weedPollen: maxOf(p.mugwort_pollen, p.ragweed_pollen),
          };
        } else {
          console.warn("Pollen API returned no current data — using nulls");
        }

        // Hourly → daily max aggregation (for 7-day outlook)
        if (pollenJson.hourly?.time) {
          (pollenJson.hourly.time as string[]).forEach((time: string, i: number) => {
            const date = time.split("T")[0];
            if (!weeklyPollenByDate[date]) {
              weeklyPollenByDate[date] = { grass: [], tree: [], weed: [] };
            }

            const gv = pollenJson.hourly.grass_pollen?.[i];
            if (gv != null && !isNaN(gv) && gv > 0) weeklyPollenByDate[date].grass.push(gv);

            const tv = maxOf(
              pollenJson.hourly.alder_pollen?.[i],
              pollenJson.hourly.birch_pollen?.[i],
              pollenJson.hourly.olive_pollen?.[i]
            );
            if (tv != null && tv > 0) weeklyPollenByDate[date].tree.push(tv);

            const wv = maxOf(
              pollenJson.hourly.mugwort_pollen?.[i],
              pollenJson.hourly.ragweed_pollen?.[i]
            );
            if (wv != null && wv > 0) weeklyPollenByDate[date].weed.push(wv);
          });
        }
      } else {
        const body = await pollenRes.text();
        console.warn(`Pollen API ${pollenRes.status} — using nulls:`, body);
      }
    } catch (pollenErr) {
      console.warn("Pollen API fetch failed — using nulls:", pollenErr);
    }

    // Build 7-day forecast
    const weeklyForecast: DailyForecast[] = [];
    if (weatherJson.daily?.time) {
      (weatherJson.daily.time as string[]).forEach((date: string, i: number) => {
        const pd = weeklyPollenByDate[date];
        weeklyForecast.push({
          date,
          maxTemp: Math.round(weatherJson.daily.temperature_2m_max?.[i] ?? 0),
          weatherCode: weatherJson.daily.weather_code?.[i] ?? 0,
          precipProbability: Math.round(weatherJson.daily.precipitation_probability_max?.[i] ?? 0),
          grassPollen: pd?.grass.length ? Math.max(...pd.grass) : null,
          treePollen: pd?.tree.length  ? Math.max(...pd.tree)  : null,
          weedPollen: pd?.weed.length  ? Math.max(...pd.weed)  : null,
        });
      });
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
      weeklyForecast,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch (err) {
    console.error("Conditions API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conditions data" },
      { status: 500 }
    );
  }
}
