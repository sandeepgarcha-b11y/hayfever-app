import { Leaf, SlidersHorizontal } from "lucide-react";
import type { AllergyProfile, PollenData, PollenLevel } from "@/lib/types";
import { getPollenLevel, getPollenLevelIndex } from "@/lib/recommendations";

interface Props {
  pollen: PollenData;
  allergyProfile: AllergyProfile;
  onEditTriggers: () => void;
}

const levelConfig: Record<
  PollenLevel,
  { bg: string; text: string; bar: string; track: string; width: string }
> = {
  None:        { bg: "bg-cream-300 dark:bg-charcoal-700",    text: "text-charcoal-400 dark:text-charcoal-300", bar: "bg-charcoal-200 dark:bg-charcoal-500",  track: "bg-cream-300 dark:bg-charcoal-600",   width: "w-0"    },
  Low:         { bg: "bg-sage-100 dark:bg-sage-900",         text: "text-sage-700 dark:text-sage-300",         bar: "bg-sage-300 dark:bg-sage-500",           track: "bg-cream-300 dark:bg-charcoal-600",   width: "w-1/4"  },
  Moderate:    { bg: "bg-clay-100 dark:bg-clay-900",         text: "text-clay-700 dark:text-clay-300",         bar: "bg-clay-300 dark:bg-clay-500",           track: "bg-cream-300 dark:bg-charcoal-600",   width: "w-2/4"  },
  High:        { bg: "bg-clay-200 dark:bg-clay-800",         text: "text-clay-800 dark:text-clay-200",         bar: "bg-clay-500 dark:bg-clay-400",           track: "bg-cream-300 dark:bg-charcoal-600",   width: "w-3/4"  },
  "Very High": { bg: "bg-clay-300 dark:bg-clay-700",         text: "text-clay-900 dark:text-clay-100",         bar: "bg-clay-700 dark:bg-clay-300",           track: "bg-cream-300 dark:bg-charcoal-600",   width: "w-full" },
};

const POLLEN_TYPES: Array<{ key: keyof AllergyProfile; label: string; dataKey: keyof PollenData }> = [
  { key: "grass", label: "Grass", dataKey: "grassPollen" },
  { key: "tree", label: "Tree", dataKey: "treePollen" },
  { key: "weed", label: "Weed", dataKey: "weedPollen" },
];

function PollenRow({
  label,
  value,
  tracked,
}: {
  label: string;
  value: number | null;
  tracked: boolean;
}) {
  const level = getPollenLevel(value);
  const config = levelConfig[level];

  return (
    <div className={`space-y-1.5 transition-opacity ${tracked ? "" : "opacity-55"}`}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-charcoal-600 dark:text-charcoal-200 font-medium">
          {label}
          {!tracked && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-charcoal-300 dark:text-charcoal-500">
              Off
            </span>
          )}
        </span>
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.bg} ${config.text}`}>
          {level}
          {value !== null && value > 0 && (
            <span className="ml-1 font-normal opacity-60">({Math.round(value)})</span>
          )}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${config.track}`}>
        <div className={`h-full rounded-full transition-all duration-500 ${config.bar} ${config.width}`} />
      </div>
    </div>
  );
}

function triggerLevel(pollen: PollenData, allergyProfile: AllergyProfile): PollenLevel {
  return POLLEN_TYPES.map(({ key, dataKey }) =>
    allergyProfile[key] ? getPollenLevel(pollen[dataKey]) : "None"
  ).reduce((max, level) =>
    getPollenLevelIndex(level) > getPollenLevelIndex(max) ? level : max
  );
}

export default function PollenCard({ pollen, allergyProfile, onEditTriggers }: Props) {
  const overall = triggerLevel(pollen, allergyProfile);
  const config = levelConfig[overall];
  const activeTriggers = POLLEN_TYPES.filter(({ key }) => allergyProfile[key]);

  return (
    <div className="h-full bg-[var(--card)] rounded-2xl shadow-sm border border-cream-400 dark:border-charcoal-600 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xs font-semibold text-charcoal-400 dark:text-charcoal-300 uppercase tracking-widest mb-2">
            Pollen
          </h2>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-semibold text-charcoal-800 dark:text-cream-200">Trigger level</span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.bg} ${config.text}`}>
              {overall}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEditTriggers}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium text-charcoal-400 transition-colors hover:bg-sage-50 hover:text-sage-600 focus:outline-none focus:ring-2 focus:ring-sage-400 dark:text-charcoal-300 dark:hover:bg-charcoal-700 dark:hover:text-sage-300"
            aria-label="Edit pollen triggers"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
          <div className={`p-2 rounded-xl ${config.bg}`}>
            <Leaf className={`w-5 h-5 ${config.text}`} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {POLLEN_TYPES.map(({ key, label, dataKey }) => (
          <PollenRow
            key={key}
            label={`${label} pollen`}
            value={pollen[dataKey]}
            tracked={allergyProfile[key]}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-charcoal-300 dark:text-charcoal-500">Tracking</span>
        {activeTriggers.map(({ key, label }) => (
          <span
            key={key}
            className="rounded-full bg-sage-100 px-2.5 py-1 text-xs font-semibold text-sage-700 dark:bg-sage-900 dark:text-sage-300"
          >
            {label}
          </span>
        ))}
      </div>

      <p className="text-xs text-charcoal-300 dark:text-charcoal-500 mt-5">
        Pollen index sourced from Google Pollen API data
      </p>
    </div>
  );
}
