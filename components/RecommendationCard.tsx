import { Pill, ShirtIcon, CheckCircle2, XCircle } from "lucide-react";
import type { Recommendation } from "@/lib/types";

interface Props {
  recommendation: Recommendation;
}

export default function RecommendationCard({ recommendation }: Props) {
  const { antihistamine, antihistamineReason, clothing } = recommendation;

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm border border-cream-400">
      {/* Hero banner */}
      <div
        className={`px-6 pt-7 pb-6 ${
          antihistamine
            ? "bg-clay-100 border-b border-clay-200"
            : "bg-sage-50 border-b border-sage-100"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-3 ${
          antihistamine ? 'text-clay-600' : 'text-sage-600'
        }">
          <span className={antihistamine ? "text-clay-600" : "text-sage-600"}>
            Today&apos;s verdict
          </span>
        </p>

        <div className="flex items-center gap-3 mb-3">
          <div
            className={`p-2.5 rounded-full ${
              antihistamine ? "bg-clay-200" : "bg-sage-100"
            }`}
          >
            <Pill
              className={`w-6 h-6 ${
                antihistamine ? "text-clay-700" : "text-sage-600"
              }`}
            />
          </div>
          <h2
            className={`text-2xl font-semibold tracking-tight ${
              antihistamine ? "text-clay-900" : "text-sage-900"
            }`}
          >
            {antihistamine ? "Take an antihistamine" : "No antihistamine needed"}
          </h2>
          {antihistamine ? (
            <CheckCircle2 className="w-6 h-6 text-clay-500 flex-shrink-0" />
          ) : (
            <XCircle className="w-6 h-6 text-sage-400 flex-shrink-0" />
          )}
        </div>

        <p
          className={`text-sm leading-relaxed ${
            antihistamine ? "text-clay-700" : "text-sage-700"
          }`}
        >
          {antihistamineReason}
        </p>
      </div>

      {/* Clothing section */}
      <div className="px-6 py-5 bg-[var(--card)]">
        <div className="flex items-center gap-2 mb-4">
          <ShirtIcon className="w-4 h-4 text-charcoal-400" />
          <span className="text-sm font-semibold text-charcoal-700 uppercase tracking-wide">
            What to wear
          </span>
        </div>
        <ul className="space-y-2.5">
          {clothing.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-2 w-1.5 h-1.5 flex-shrink-0 rounded-full bg-sage-400" />
              <div>
                <span className="text-sm font-medium text-charcoal-800">
                  {item.label}
                </span>
                <span className="text-charcoal-400 text-sm"> — {item.reason}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
