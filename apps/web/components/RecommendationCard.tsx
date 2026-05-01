import { Pill, ShirtIcon, CheckCircle2, CloudSun, Droplets, Leaf, Wind } from "lucide-react";
import type { AllergyProfile, PollenData, PollenLevel, Recommendation, WeatherData } from "@hayfever/core";
import { getPollenLevel, getPollenLevelIndex, getWeatherDescription } from "@hayfever/core";

interface Props {
  recommendation: Recommendation;
  weather: WeatherData;
  pollen: PollenData;
  allergyProfile: AllergyProfile;
}

const BADGE_TONE: Record<PollenLevel, string> = {
  None: "bg-charcoal-100 text-charcoal-500 dark:bg-charcoal-700 dark:text-charcoal-300",
  Low: "bg-sage-100 text-sage-700 dark:bg-sage-900 dark:text-sage-300",
  Moderate: "bg-clay-100 text-clay-700 dark:bg-clay-900 dark:text-clay-300",
  High: "bg-clay-200 text-clay-800 dark:bg-clay-800 dark:text-clay-200",
  "Very High": "bg-clay-300 text-clay-900 dark:bg-clay-700 dark:text-clay-100",
};

function triggerPollenLevel(pollen: PollenData, allergyProfile: AllergyProfile): PollenLevel {
  const levels: PollenLevel[] = [
    allergyProfile.grass ? getPollenLevel(pollen.grassPollen) : "None",
    allergyProfile.tree ? getPollenLevel(pollen.treePollen) : "None",
    allergyProfile.weed ? getPollenLevel(pollen.weedPollen) : "None",
  ];
  return levels.reduce((max, level) =>
    getPollenLevelIndex(level) > getPollenLevelIndex(max) ? level : max
  );
}

export default function RecommendationCard({ recommendation, weather, pollen, allergyProfile }: Props) {
  const { antihistamine, antihistamineReason, clothing } = recommendation;
  const pollenLevel = triggerPollenLevel(pollen, allergyProfile);

  return (
    <section className="rounded-2xl overflow-hidden shadow-sm border border-cream-400 dark:border-charcoal-600 bg-[var(--card)]">
      <div
        className={`grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] px-5 py-6 sm:px-7 sm:py-7 ${
          antihistamine
            ? "bg-clay-100 dark:bg-clay-900 border-b border-clay-200 dark:border-clay-800"
            : "bg-sage-50 dark:bg-sage-900 border-b border-sage-100 dark:border-sage-800"
        }`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3">
            <span className={antihistamine ? "text-clay-600 dark:text-clay-400" : "text-sage-600 dark:text-sage-400"}>
              Today&apos;s plan
            </span>
          </p>

          <div className="flex items-start gap-3 mb-3">
            <div
              className={`p-2.5 rounded-full ${
                antihistamine
                  ? "bg-clay-200 dark:bg-clay-800"
                  : "bg-sage-100 dark:bg-sage-800"
              }`}
            >
              <Pill
                className={`w-6 h-6 ${
                  antihistamine ? "text-clay-700 dark:text-clay-300" : "text-sage-600 dark:text-sage-400"
                }`}
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2
                  className={`text-3xl sm:text-4xl font-semibold tracking-tight leading-tight ${
                    antihistamine
                      ? "text-clay-900 dark:text-clay-100"
                      : "text-sage-900 dark:text-sage-100"
                  }`}
                >
                  {antihistamine ? "Take an antihistamine" : "No antihistamine needed"}
                </h2>
                <CheckCircle2
                  className={`hidden sm:block w-6 h-6 flex-shrink-0 ${
                    antihistamine
                      ? "text-clay-500 dark:text-clay-400"
                      : "text-sage-500 dark:text-sage-400"
                  }`}
                />
              </div>

              <p
                className={`text-sm sm:text-base leading-relaxed mt-3 max-w-2xl ${
                  antihistamine ? "text-clay-700 dark:text-clay-300" : "text-sage-700 dark:text-sage-300"
                }`}
              >
                {antihistamineReason}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/55 dark:bg-charcoal-800/45 border border-white/70 dark:border-charcoal-700 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-charcoal-400 dark:text-charcoal-300 mb-3">
            Right now
          </p>
          <div className="grid grid-cols-2 gap-2">
            <SummaryStat
              icon={<Leaf className="w-4 h-4" />}
              label="Triggers"
              value={pollenLevel}
              valueClassName={BADGE_TONE[pollenLevel]}
            />
            <SummaryStat
              icon={<CloudSun className="w-4 h-4" />}
              label={getWeatherDescription(weather.weatherCode)}
              value={`${weather.temperature}°C`}
            />
            <SummaryStat
              icon={<Droplets className="w-4 h-4" />}
              label="Rain"
              value={`${weather.precipitationProbability}%`}
            />
            <SummaryStat
              icon={<Wind className="w-4 h-4" />}
              label="Wind"
              value={`${weather.windSpeed} km/h`}
            />
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-7 bg-[var(--card)]">
        <div className="flex items-center gap-2 mb-3">
          <ShirtIcon className="w-4 h-4 text-charcoal-400 dark:text-charcoal-300" />
          <span className="text-sm font-semibold text-charcoal-700 dark:text-charcoal-200 uppercase tracking-wide">
            Outdoors checklist
          </span>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {clothing.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-2 w-1.5 h-1.5 flex-shrink-0 rounded-full bg-sage-400" />
              <div>
                <span className="text-sm font-medium text-charcoal-800 dark:text-cream-200">
                  {item.label}
                </span>
                <span className="text-charcoal-400 dark:text-charcoal-300 text-sm"> — {item.reason}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--card)]/80 dark:bg-charcoal-900/35 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-charcoal-400 dark:text-charcoal-300">
        {icon}
        <span className="truncate text-[11px] font-medium">{label}</span>
      </div>
      <p
        className={`mt-1 inline-flex rounded-full text-sm font-semibold ${
          valueClassName
            ? `px-2 py-0.5 ${valueClassName}`
            : "text-charcoal-800 dark:text-cream-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
