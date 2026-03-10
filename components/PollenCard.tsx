import type { PollenData, PollenLevel } from "@/lib/types";
import { getPollenLevel } from "@/lib/recommendations";

interface Props {
  pollen: PollenData;
}

function levelBadge(level: PollenLevel) {
  const styles: Record<PollenLevel, string> = {
    None:       "bg-charcoal-100 dark:bg-charcoal-700 text-charcoal-500 dark:text-charcoal-300",
    Low:        "bg-sage-100 dark:bg-sage-900 text-sage-700 dark:text-sage-300",
    Moderate:   "bg-clay-100 dark:bg-clay-900 text-clay-700 dark:text-clay-300",
    High:       "bg-clay-200 dark:bg-clay-800 text-clay-800 dark:text-clay-200",
    "Very High":"bg-clay-300 dark:bg-clay-700 text-clay-900 dark:text-clay-100",
  };
  return styles[level] ?? styles.None;
}

function PollenRow({ label, value }: { label: string; value: number | null }) {
  const level = getPollenLevel(value);
  return (
    <div className="flex items-center justify-between py-3 border-b border-cream-300 dark:border-charcoal-600 last:border-0">
      <span className="text-sm text-charcoal-600 dark:text-charcoal-200 font-medium">{label}</span>
      <div className="flex items-center gap-3">
        {value !== null ? (
          <span className="text-sm text-charcoal-400 dark:text-charcoal-400 tabular-nums">
            {value.toFixed(1)} µg/m³
          </span>
        ) : (
          <span className="text-xs text-charcoal-300 dark:text-charcoal-500 italic">no data</span>
        )}
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${levelBadge(level)}`}
        >
          {level}
        </span>
      </div>
    </div>
  );
}

export default function PollenCard({ pollen }: Props) {
  return (
    <div className="bg-[var(--card)] rounded-2xl shadow-sm border border-cream-400 dark:border-charcoal-600 p-6">
      <h2 className="text-xs font-semibold text-charcoal-400 dark:text-charcoal-300 uppercase tracking-widest mb-4">
        Pollen
      </h2>
      <div>
        <PollenRow label="Grass" value={pollen.grassPollen} />
        <PollenRow label="Tree" value={pollen.treePollen} />
        <PollenRow label="Weed" value={pollen.weedPollen} />
      </div>
    </div>
  );
}
