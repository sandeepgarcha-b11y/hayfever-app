import { buildRecommendation } from "@hayfever/core";
import type { ConditionsResponse, DailyForecast, PollenData, WeatherData } from "@hayfever/core";

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

class ConditionsError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
  }
}

function toWmo(conditionType: string | undefined): number {
  if (!conditionType) return 3;
  return GOOGLE_CONDITION_TO_WMO[conditionType] ?? 3;
}

function toDateString(d: { year: number; month: number; day: number }): string {
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function parseCoordinate(value: string | undefined, label: string): number {
  if (!value) throw new ConditionsError(`${label} query parameter is required`, 400);

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new ConditionsError(`${label} must be a valid number`, 400);
  }

  if (label === "lat" && (parsed < -90 || parsed > 90)) {
    throw new ConditionsError("lat must be between -90 and 90", 400);
  }

  if (label === "lon" && (parsed < -180 || parsed > 180)) {
    throw new ConditionsError("lon must be between -180 and 180", 400);
  }

  return Math.round(parsed * 100) / 100;
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, any>>;
}

export async function getConditions(params: {
  lat?: string;
  lon?: string;
  apiKey?: string;
}): Promise<ConditionsResponse> {
  const apiKey = params.apiKey;
  if (!apiKey) {
    throw new ConditionsError("Server configuration error", 503);
  }

  const lat = parseCoordinate(params.lat, "lat");
  const lon = parseCoordinate(params.lon, "lon");

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

  const [hourlyRes, dailyRes, pollenRes] = await Promise.all([
    fetch(weatherHourlyUrl),
    fetch(weatherDailyUrl),
    fetch(pollenUrl),
  ]);

  if (!hourlyRes.ok) {
    throw new ConditionsError(`Weather hourly API error: ${hourlyRes.status}`, 502);
  }

  const hourlyJson = await readJson(hourlyRes);
  const currentHour = (hourlyJson.forecastHours as Array<Record<string, any>> | undefined)?.[0];
  if (!currentHour) {
    throw new ConditionsError("Weather API returned no current data", 502);
  }

  const weather: WeatherData = {
    temperature: Math.round(currentHour.temperature?.degrees ?? 0),
    feelsLike: Math.round(currentHour.feelsLikeTemperature?.degrees ?? 0),
    uvIndex: Math.round(currentHour.uvIndex ?? 0),
    windSpeed: Math.round(currentHour.wind?.speed?.value ?? 0),
    windDirection: currentHour.wind?.direction?.degrees ?? 0,
    precipitationProbability: currentHour.precipitation?.probability?.percent ?? 0,
    weatherCode: toWmo(currentHour.weatherCondition?.type),
    isDay: currentHour.isDaytime ? 1 : 0,
  };

  const weeklyForecast: DailyForecast[] = [];
  if (dailyRes.ok) {
    const dailyJson = await readJson(dailyRes);
    (dailyJson.forecastDays as Array<Record<string, any>> | undefined ?? []).forEach((day) => {
      if (!day.displayDate) return;
      weeklyForecast.push({
        date: toDateString(day.displayDate),
        maxTemp: Math.round(day.maxTemperature?.degrees ?? 0),
        weatherCode: toWmo(day.daytimeForecast?.weatherCondition?.type),
        precipProbability: Math.round(day.daytimeForecast?.precipitation?.probability?.percent ?? 0),
        grassPollen: null,
        treePollen: null,
        weedPollen: null,
      });
    });
  }

  let pollen: PollenData = { grassPollen: null, treePollen: null, weedPollen: null };
  if (pollenRes.ok) {
    const pollenJson = await readJson(pollenRes);
    const days = pollenJson.dailyInfo as Array<{
      date?: { year: number; month: number; day: number };
      pollenTypeInfo?: Array<{ code: string; indexInfo?: { value: number } }>;
    }> | undefined;

    if (days?.length) {
      const today = days[0];
      const getUpi = (code: string): number | null => {
        const entry = today.pollenTypeInfo?.find((p) => p.code === code);
        return entry?.indexInfo?.value ?? null;
      };

      pollen = {
        grassPollen: getUpi("GRASS"),
        treePollen: getUpi("TREE"),
        weedPollen: getUpi("WEED"),
      };

      days.forEach((day) => {
        if (!day.date) return;
        const dateStr = toDateString(day.date);
        const slot = weeklyForecast.find((forecast) => forecast.date === dateStr);
        if (!slot) return;

        const getUpiForDay = (code: string): number | null => {
          const entry = day.pollenTypeInfo?.find((p) => p.code === code);
          return entry?.indexInfo?.value ?? null;
        };

        slot.grassPollen = getUpiForDay("GRASS");
        slot.treePollen = getUpiForDay("TREE");
        slot.weedPollen = getUpiForDay("WEED");
      });
    }
  }

  return {
    weather,
    pollen,
    recommendation: buildRecommendation(weather, pollen),
    locationName: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    fetchedAt: new Date().toISOString(),
    weeklyForecast,
  };
}

export function toHttpError(err: unknown): { message: string; status: number } {
  if (err instanceof ConditionsError) {
    return { message: err.message, status: err.status };
  }

  return { message: "Failed to fetch conditions data", status: 500 };
}
