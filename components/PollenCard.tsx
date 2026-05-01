import { Leaf } from "lucide-react";
import type { PollenData, PollenLevel } from "@/lib/types";
import { getPollenLevel } from "@/lib/recommendations";

interface Props {
  pollen: PollenData;
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

function PollenRow({ label, value }: { label: string; value: number | null }) {
  const level = getPollenLevel(value);
  const config = levelConfig[level];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-charcoal-600 dark:text-charcoal-200 font-medium">{label}</span>
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

function overallLevel(pollen: PollenData): PollenLevel {
  const levels: PollenLevel[] = [
    getPollenLevel(pollen.grassPollen),
    getPollenLevel(pollen.treePollen),
    getPollenLevel(pollen.weedPollen),
  ];
  const order: PollenLevel[] = ["None", "Low", "Moderate", "High", "Very High"];
  return levels.reduce((max, l) =>
    order.indexOf(l) > order.indexOf(max) ? l : max
  );
}

export default function PollenCard({ pollen }: Props) {
  const overall = overallLevel(pollen);
  const config = levelConfig[overall];

  return (
    <div className="bg-[var(--card)] rounded-2xl shadow-sm border border-cream-400 dark:border-charcoal-600 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xs font-semibold text-charcoal-400 dark:text-charcoal-300 uppercase tracking-widest mb-2">
            Pollen
          </h2>
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-semibold text-charcoal-800 dark:text-cream-200">Overall</span>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.bg} ${config.text}`}>
              {overall}
            </span>
          </div>
        </div>
        <div className={`p-2 rounded-xl ${config.bg}`}>
          <Leaf className={`w-5 h-5 ${config.text}`} />
        </div>
      </div>

      <div className="space-y-4">
        <PollenRow label="Grass pollen" value={pollen.grassPollen} />
        <PollenRow label="Tree pollen" value={pollen.treePollen} />
        <PollenRow label="Weed pollen" value={pollen.weedPollen} />
      </div>

      <p className="text-xs text-charcoal-300 dark:text-charcoal-500 mt-5">
        Pollen index sourced from Google Pollen API data
      </p>
    </div>
  );
}
