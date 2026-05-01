import { Sun, Cloud, CloudRain, CloudSnow, Zap } from "lucide-react";
import type { DailyForecast, PollenLevel, AllergyProfile } from "@/lib/types";
import { getPollenLevel, getPollenLevelIndex } from "@/lib/recommendations";

interface Props {
  forecasts: DailyForecast[];
  allergyProfile?: AllergyProfile | null;
}

function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code <= 1) return <Sun className={className} />;
  if (code <= 3) return <Cloud className={className} />;
  if (code <= 69) return <CloudRain className={className} />;
  if (code <= 79) return <CloudSnow className={className} />;
  if (code <= 84) return <CloudRain className={className} />;
  return <Zap className={className} />;
}

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  // Noon UTC avoids date boundary issues across timezones
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString([], { weekday: "short" });
}

function overallLevel(forecast: DailyForecast, profile: AllergyProfile): PollenLevel {
  const levels: PollenLevel[] = [
    profile.grass ? getPollenLevel(forecast.grassPollen) : "None",
    profile.tree  ? getPollenLevel(forecast.treePollen)  : "None",
    profile.weed  ? getPollenLevel(forecast.weedPollen)  : "None",
  ];
  return levels.reduce((max, l) => (getPollenLevelIndex(l) > getPollenLevelIndex(max) ? l : max));
}

const BADGE: Record<PollenLevel, string> = {
  None:        "bg-charcoal-100 dark:bg-charcoal-600 text-charcoal-400 dark:text-charcoal-300",
  Low:         "bg-sage-100 dark:bg-sage-900 text-sage-700 dark:text-sage-300",
  Moderate:    "bg-clay-100 dark:bg-clay-900 text-clay-700 dark:text-clay-300",
  High:        "bg-clay-200 dark:bg-clay-800 text-clay-800 dark:text-clay-200",
  "Very High": "bg-clay-300 dark:bg-clay-700 text-clay-900 dark:text-clay-100",
};

export default function WeeklyOutlook({ forecasts, allergyProfile }: Props) {
  if (!forecasts || forecasts.length === 0) return null;

  const profile: AllergyProfile = allergyProfile ?? { grass: true, tree: true, weed: true };
  const outlookLabel = forecasts.length === 1 ? "Today's Outlook" : `${forecasts.length}-Day Outlook`;

  return (
    <div className="bg-[var(--card)] rounded-2xl shadow-sm border border-cream-400 dark:border-charcoal-600 p-6">
      <h2 className="text-xs font-semibold text-charcoal-400 dark:text-charcoal-300 uppercase tracking-widest mb-4">
        {outlookLabel}
      </h2>

      <div className="overflow-x-auto -mx-1 pb-1">
        <div className="flex gap-1.5 sm:gap-2 min-w-max px-1">
          {forecasts.map((forecast, i) => {
            const level = overallLevel(forecast, profile);
            const isToday = i === 0;

            return (
              <div
                key={forecast.date}
                className={`flex flex-col items-center gap-2 px-2 sm:px-3 py-3 rounded-xl min-w-[56px] sm:min-w-[72px] ${
                  isToday
                    ? "bg-sage-50 dark:bg-sage-900/40 border border-sage-200 dark:border-sage-700"
                    : "bg-cream-100 dark:bg-charcoal-700"
                }`}
              >
                <span className={`text-xs font-semibold ${isToday ? "text-sage-700 dark:text-sage-300" : "text-charcoal-500 dark:text-charcoal-300"}`}>
                  {dayLabel(forecast.date, i)}
                </span>
                <WeatherIcon
                  code={forecast.weatherCode}
                  className="w-5 h-5 text-clay-400 dark:text-clay-300"
                />
                <span className="text-sm font-semibold text-charcoal-800 dark:text-cream-200">
                  {forecast.maxTemp}°
                </span>
                <span className={`text-[9px] sm:text-[10px] font-semibold px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap ${BADGE[level]}`}>
                  {level}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-charcoal-300 dark:text-charcoal-500 mt-3">
        Pollen badge shows your relevant allergens only
      </p>
    </div>
  );
}
