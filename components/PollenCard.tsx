import { Leaf } from "lucide-react";
import type { PollenData, PollenLevel } from "@/lib/types";
import { getPollenLevel } from "@/lib/recommendations";

interface Props {
  pollen: PollenData;
}

const levelConfig: Record<PollenLevel, { bg: string; text: string; bar: string; width: string }> = {
  None:       { bg: "bg-stone-100",   text: "text-stone-500",  bar: "bg-stone-300",  width: "w-0"    },
  Low:        { bg: "bg-green-100",   text: "text-green-700",  bar: "bg-green-500",  width: "w-1/4"  },
  Moderate:   { bg: "bg-yellow-100",  text: "text-yellow-700", bar: "bg-yellow-400", width: "w-2/4"  },
  High:       { bg: "bg-orange-100",  text: "text-orange-700", bar: "bg-orange-500", width: "w-3/4"  },
  "Very High":{ bg: "bg-red-100",     text: "text-red-700",    bar: "bg-red-500",    width: "w-full" },
};

function PollenRow({ label, value }: { label: string; value: number | null }) {
  const level = getPollenLevel(value);
  const config = levelConfig[level];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-600 font-medium">{label}</span>
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}
        >
          {level}
          {value !== null && value > 0 && (
            <span className="ml-1 font-normal opacity-70">({Math.round(value)})</span>
          )}
        </span>
      </div>
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${config.bar} ${config.width}`}
        />
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
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-1">
            Pollen
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-semibold text-stone-800">
              Overall:{" "}
            </span>
            <span
              className={`text-sm font-semibold px-3 py-1 rounded-full ${config.bg} ${config.text}`}
            >
              {overall}
            </span>
          </div>
        </div>
        <div className={`p-2 rounded-xl ${config.bg}`}>
          <Leaf className={`w-6 h-6 ${config.text}`} />
        </div>
      </div>

      <div className="space-y-4">
        <PollenRow label="Grass pollen" value={pollen.grassPollen} />
        <PollenRow label="Tree pollen" value={pollen.treePollen} />
        <PollenRow label="Weed pollen" value={pollen.weedPollen} />
      </div>

      <p className="text-xs text-stone-400 mt-4">
        Pollen index sourced from Open-Meteo air quality data
      </p>
    </div>
  );
}
