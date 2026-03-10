import { Sun, CloudRain, Cloud, CloudSnow, Wind, Droplets, Thermometer, Zap } from "lucide-react";
import type { WeatherData } from "@/lib/types";
import { getWeatherDescription } from "@/lib/recommendations";

interface Props {
  weather: WeatherData;
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
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
  if (uv <= 2) return { label: "Low", colour: "text-sage-600 dark:text-sage-400" };
  if (uv <= 5) return { label: "Moderate", colour: "text-clay-500 dark:text-clay-400" };
  if (uv <= 7) return { label: "High", colour: "text-clay-600 dark:text-clay-400" };
  if (uv <= 10) return { label: "Very High", colour: "text-clay-700 dark:text-clay-300" };
  return { label: "Extreme", colour: "text-clay-800 dark:text-clay-200" };
}

export default function WeatherCard({ weather }: Props) {
  const uv = uvLabel(weather.uvIndex);

  return (
    <div className="bg-[var(--card)] rounded-2xl shadow-sm border border-cream-400 dark:border-charcoal-600 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xs font-semibold text-charcoal-400 dark:text-charcoal-300 uppercase tracking-widest mb-1">
            Weather
          </h2>
          <p className="text-charcoal-500 dark:text-charcoal-300 text-sm">
            {getWeatherDescription(weather.weatherCode)}
          </p>
        </div>
        <WeatherIcon
          code={weather.weatherCode}
          className="w-9 h-9 text-clay-400 dark:text-clay-300"
        />
      </div>

      {/* Big temperature */}
      <div className="mb-6">
        <span className="text-6xl font-light text-charcoal-800 dark:text-cream-200">
          {weather.temperature}°
        </span>
        <span className="text-charcoal-400 dark:text-charcoal-300 text-lg ml-1">C</span>
        <p className="text-charcoal-400 dark:text-charcoal-300 text-sm mt-1">
          Feels like {weather.feelsLike}°C
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <Stat
          icon={<Droplets className="w-4 h-4 text-sage-400" />}
          label="Rain chance"
          value={`${weather.precipitationProbability}%`}
        />
        <Stat
          icon={<Wind className="w-4 h-4 text-charcoal-300 dark:text-charcoal-400" />}
          label="Wind"
          value={`${weather.windSpeed} km/h ${compassDirection(weather.windDirection)}`}
        />
        <Stat
          icon={<Sun className="w-4 h-4 text-clay-400 dark:text-clay-300" />}
          label="UV Index"
          value={
            <span>
              {weather.uvIndex}{" "}
              <span className={`text-xs font-medium ${uv.colour}`}>{uv.label}</span>
            </span>
          }
        />
        <Stat
          icon={<Thermometer className="w-4 h-4 text-clay-300 dark:text-clay-400" />}
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
    <div className="flex items-center gap-2 bg-cream-200 dark:bg-charcoal-700 rounded-xl px-3 py-2.5">
      {icon}
      <div className="min-w-0">
        <p className="text-xs text-charcoal-400 dark:text-charcoal-300">{label}</p>
        <p className="text-sm font-medium text-charcoal-700 dark:text-cream-200 truncate">{value}</p>
      </div>
    </div>
  );
}
