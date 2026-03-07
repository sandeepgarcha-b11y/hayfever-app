import { Pill, ShirtIcon, CheckCircle2, XCircle } from "lucide-react";
import type { Recommendation } from "@/lib/types";

interface Props {
  recommendation: Recommendation;
}

export default function RecommendationCard({ recommendation }: Props) {
  const { antihistamine, antihistamineReason, clothing } = recommendation;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-5">
      <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
        Today&apos;s Recommendations
      </h2>

      {/* Antihistamine */}
      <div
        className={`flex items-start gap-4 rounded-xl p-4 ${
          antihistamine ? "bg-amber-50 border border-amber-200" : "bg-green-50 border border-green-200"
        }`}
      >
        <div
          className={`mt-0.5 flex-shrink-0 rounded-full p-1.5 ${
            antihistamine ? "bg-amber-100" : "bg-green-100"
          }`}
        >
          <Pill
            className={`w-5 h-5 ${antihistamine ? "text-amber-600" : "text-green-600"}`}
          />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-stone-800 text-sm">Antihistamine</span>
            {antihistamine ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> Recommended
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3" /> Not needed
              </span>
            )}
          </div>
          <p className="text-sm text-stone-500 leading-relaxed">{antihistamineReason}</p>
        </div>
      </div>

      {/* Clothing */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShirtIcon className="w-4 h-4 text-stone-500" />
          <span className="text-sm font-medium text-stone-700">What to wear</span>
        </div>
        <ul className="space-y-2">
          {clothing.map((item, i) => (
            <li
              key={i}
              className="flex items-start gap-3 bg-stone-50 rounded-xl px-3 py-2.5"
            >
              <span className="mt-0.5 w-1.5 h-1.5 flex-shrink-0 rounded-full bg-green-500 mt-1.5" />
              <div>
                <span className="text-sm font-medium text-stone-700">{item.label}</span>
                <span className="text-stone-400 text-sm"> — {item.reason}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
