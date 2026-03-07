import {
  Sun,
  CloudRain,
  Cloud,
  CloudSnow,
  Wind,
  Droplets,
  Thermometer,
  Zap,
} from "lucide-react";
import type { WeatherData } from "@/lib/types";
import { getWeatherDescription } from "@/lib/recommendations";

interface Props {
  weather: WeatherData;
}

function WeatherIcon({ code, className }: { code: number; isDay?: number; className?: string }) {
  if (code === 0 || code === 1) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 69) return <CloudRain className={className} />;
  if (code <= 79) return <CloudSnow className={className} />;
  if (code <= 84) return <CloudRain className={className} />;
  return <Zap className={className} />;
}

function compassDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv: number): { label: string; colour: string } {
  if (uv <= 2) return { label: "Low", colour: "text-green-700" };
  if (uv <= 5) return { label: "Moderate", colour: "text-yellow-600" };
  if (uv <= 7) return { label: "High", colour: "text-orange-600" };
  if (uv <= 10) return { label: "Very High", colour: "text-red-600" };
  return { label: "Extreme", colour: "text-purple-700" };
}

export default function WeatherCard({ weather }: Props) {
  const uv = uvLabel(weather.uvIndex);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-1">
            Weather
          </h2>
          <p className="text-stone-600 text-sm">{getWeatherDescription(weather.weatherCode)}</p>
        </div>
        <WeatherIcon
          code={weather.weatherCode}
          isDay={weather.isDay}
          className="w-10 h-10 text-amber-500"
        />
      </div>

      {/* Big temperature */}
      <div className="mb-6">
        <span className="text-6xl font-light text-stone-800">{weather.temperature}°</span>
        <span className="text-stone-400 text-lg ml-1">C</span>
        <p className="text-stone-500 text-sm mt-1">
          Feels like {weather.feelsLike}°C
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Droplets className="w-4 h-4 text-blue-500" />}
          label="Rain chance"
          value={`${weather.precipitationProbability}%`}
        />
        <Stat
          icon={<Wind className="w-4 h-4 text-stone-400" />}
          label="Wind"
          value={`${weather.windSpeed} km/h ${compassDirection(weather.windDirection)}`}
        />
        <Stat
          icon={<Sun className="w-4 h-4 text-amber-500" />}
          label="UV Index"
          value={
            <span>
              {weather.uvIndex}{" "}
              <span className={`text-xs font-medium ${uv.colour}`}>{uv.label}</span>
            </span>
          }
        />
        <Stat
          icon={<Thermometer className="w-4 h-4 text-rose-400" />}
          label="Feels like"
          value={`${weather.feelsLike}°C`}
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2.5">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-stone-400">{label}</p>
        <p className="text-sm font-medium text-stone-700 truncate">{value}</p>
      </div>
    </div>
  );
}
