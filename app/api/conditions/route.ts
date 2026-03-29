import { NextRequest, NextResponse } from "next/server";
import { buildRecommendation } from "@/lib/recommendations";
import type { WeatherData, PollenData, ConditionsResponse, DailyForecast } from "@/lib/types";

// ── Google weather condition type → WMO-equivalent numeric code ──────────────
// Keeps all downstream components (WeatherBackground, WeatherCard, WeeklyOutlook)
// working without changes.
const GOOGLE_CONDITION_TO_WMO: Record<string, number> = {
  CLEAR: 0,
  MOSTLY_CLEAR: 0,
  PARTLY_CLOUDY: 2,
  MOSTLY_CLOUDY: 3,
  CLOUDY: 3,
  FOG: 45,
  HAZE: 45,
  LIGHT_DRIZZLE: 51,
  DRIZZLE: 51,
  HEAVY_DRIZZLE: 53,
  LIGHT_RAIN: 61,
  RAIN: 61,
  HEAVY_RAIN: 65,
  RAIN_SHOWERS: 80,
  LIGHT_SNOW: 71,
  SNOW: 71,
  HEAVY_SNOW: 75,
  SNOW_SHOWERS: 85,
  BLIZZARD: 75,
  ICE_PELLETS: 79,
  FREEZING_RAIN: 67,
  THUNDERSTORM: 95,
  THUNDERSTORM_WITH_HAIL: 99,
  WINDY: 3,
  TORNADO: 99,
};

function toWmo(conditionType: string | undefined): number {
  if (!conditionType) return 3;
  return GOOGLE_CONDITION_TO_WMO[conditionType] ?? 3;
}

function toDateString(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latRaw = searchParams.get("lat");
  const lonRaw = searchParams.get("lon");

  if (!latRaw || !lonRaw) {
    return NextResponse.json(
      { error: "lat and lon query parameters are required" },
      { status: 400 }
    );
  }

  const latParsed = parseFloat(latRaw);
  const lonParsed = parseFloat(lonRaw);

  if (isNaN(latParsed) || isNaN(lonParsed)) {
    return NextResponse.json(
      { error: "lat and lon must be valid numbers" },
      { status: 400 }
    );
  }

  // Round to 2 decimal places (~1.1 km) so nearby GPS readings share the same
  // cache entry and don't generate extra API calls.
  const lat = Math.round(latParsed * 100) / 100;
  const lon = Math.round(lonParsed * 100) / 100;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_MAPS_API_KEY is not set");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 503 }
    );
  }

  const weatherHourlyUrl =
    `https://weather.googleapis.com/v1/forecast/hours:lookup` +
    `?key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}` +
    `&hours=1&unitsSystem=METRIC`;

  const weatherDailyUrl =
    `https://weather.googleapis.com/v1/forecast/days:lookup` +
    `?key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}` +
    `&days=7&unitsSystem=METRIC`;

  const pollenUrl =
    `https://pollen.googleapis.com/v1/forecast:lookup` +
    `?key=${apiKey}&location.latitude=${lat}&location.longitude=${lon}` +
    `&days=5&plantsDescription=0`;

  const nominatimUrl =
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

  try {
    // All four requests in parallel — Next.js Data Cache deduplicates by URL.
    const [hourlyRes, dailyRes, pollenRes, geoRes] = await Promise.all([
      fetch(weatherHourlyUrl, { next: { revalidate: 1800 } }),
      fetch(weatherDailyUrl,  { next: { revalidate: 1800 } }),
      fetch(pollenUrl,        { next: { revalidate: 3600 } }),
      fetch(nominatimUrl, {
        headers: { "User-Agent": "hayfever-app/1.0" },
        next: { revalidate: 86400 },
      }),
    ]);

    // ── Current weather ───────────────────────────────────────────────────────
    if (!hourlyRes.ok) {
      const body = await hourlyRes.text();
      console.error(`Google Weather hourly API error ${hourlyRes.status}:`, body);
      throw new Error(`Weather hourly API error: ${hourlyRes.status}`);
    }

    const hourlyJson = await hourlyRes.json();
    const currentHour = hourlyJson.forecastHours?.[0];

    if (!currentHour) {
      console.error("Google Weather API returned no hourly data:", JSON.stringify(hourlyJson));
      throw new Error("Weather API returned no current data");
    }

    const weather: WeatherData = {
      temperature:              Math.round(currentHour.temperature?.degrees ?? 0),
      feelsLike:                Math.round(currentHour.feelsLikeTemperature?.degrees ?? 0),
      uvIndex:                  Math.round(currentHour.uvIndex ?? 0),
      windSpeed:                Math.round(currentHour.wind?.speed?.value ?? 0),
      windDirection:            currentHour.wind?.direction?.degrees ?? 0,
      precipitationProbability: currentHour.precipitation?.probability?.percent ?? 0,
      weatherCode:              toWmo(currentHour.weatherCondition?.type),
      isDay:                    currentHour.isDaytime ? 1 : 0,
    };

    // ── 7-day daily forecast ──────────────────────────────────────────────────
    const weeklyForecast: DailyForecast[] = [];

    if (dailyRes.ok) {
      const dailyJson = await dailyRes.json();
      (dailyJson.forecastDays ?? []).forEach((day: {
        displayDate?: { year: number; month: number; day: number };
        maxTemperature?: { degrees: number };
        daytimeForecast?: {
          weatherCondition?: { type?: string };
          precipitation?: { probability?: { percent?: number } };
        };
      }) => {
        if (!day.displayDate) return;
        weeklyForecast.push({
          date:             toDateString(day.displayDate),
          maxTemp:          Math.round(day.maxTemperature?.degrees ?? 0),
          weatherCode:      toWmo(day.daytimeForecast?.weatherCondition?.type),
          precipProbability: Math.round(day.daytimeForecast?.precipitation?.probability?.percent ?? 0),
          // Pollen is merged in below from the pollen response
          grassPollen: null,
          treePollen:  null,
          weedPollen:  null,
        });
      });
    } else {
      const body = await dailyRes.text();
      console.warn(`Google Weather daily API ${dailyRes.status} — skipping weekly forecast:`, body);
    }

    // ── Current pollen + 5-day pollen overlay onto weekly forecast ────────────
    let pollen: PollenData = { grassPollen: null, treePollen: null, weedPollen: null };

    if (pollenRes.ok) {
      const pollenJson = await pollenRes.json();
      const days: Array<{
        date?: { year: number; month: number; day: number };
        pollenTypeInfo?: Array<{ code: string; indexInfo?: { value: number } }>;
      }> = pollenJson.dailyInfo ?? [];

      if (days.length > 0) {
        // Today's pollen = first day in the response
        const today = days[0];
        const getUpi = (code: string): number | null => {
          const entry = today.pollenTypeInfo?.find((p) => p.code === code);
          return entry?.indexInfo?.value ?? null;
        };
        pollen = {
          grassPollen: getUpi("GRASS"),
          treePollen:  getUpi("TREE"),
          weedPollen:  getUpi("WEED"),
        };

        // Overlay pollen onto weekly forecast by matching date strings
        days.forEach((d) => {
          if (!d.date) return;
          const dateStr = toDateString(d.date);
          const slot = weeklyForecast.find((f) => f.date === dateStr);
          if (!slot) return;
          const getUpiForDay = (code: string): number | null => {
            const entry = d.pollenTypeInfo?.find((p) => p.code === code);
            return entry?.indexInfo?.value ?? null;
          };
          slot.grassPollen = getUpiForDay("GRASS");
          slot.treePollen  = getUpiForDay("TREE");
          slot.weedPollen  = getUpiForDay("WEED");
        });
      } else {
        console.warn("Pollen API returned no daily data — using nulls");
      }
    } else {
      const body = await pollenRes.text();
      console.warn(`Google Pollen API ${pollenRes.status} — using nulls:`, body);
    }

    // ── Location name from Nominatim ──────────────────────────────────────────
    const geoJson = geoRes.ok ? await geoRes.json().catch(() => null) : null;
    let locationName = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    if (geoJson?.address) {
      const a = geoJson.address;
      const parts = [
        a.city || a.town || a.village || a.hamlet || a.suburb,
        a.state || a.county,
        a.country,
      ].filter(Boolean);
      if (parts.length) locationName = parts.join(", ");
    }

    const recommendation = buildRecommendation(weather, pollen);

    const response: ConditionsResponse = {
      weather,
      pollen,
      recommendation,
      locationName,
      fetchedAt:      new Date().toISOString(),
      weeklyForecast,
    };

    return NextResponse.json(response, {
      headers: {
        // public: location weather isn't user-specific, CDN/Edge can cache it
        // stale-while-revalidate: browser serves stale instantly, refreshes in background
        "Cache-Control": "public, max-age=1800, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("Conditions API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conditions data" },
      { status: 500 }
    );
  }
}
