"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Leaf } from "lucide-react";
import type { AllergyProfile } from "@/lib/types";

interface Props {
  initial?: AllergyProfile;
  onSave: (profile: AllergyProfile) => void;
}

const POLLEN_TYPES: Array<{ key: keyof AllergyProfile; label: string; description: string }> = [
  { key: "grass",  label: "Grass",  description: "Timothy, rye, meadow grass" },
  { key: "tree",   label: "Tree",   description: "Birch, alder, olive" },
  { key: "weed",   label: "Weed",   description: "Mugwort, ragweed" },
];

export default function AllergyProfileSetup({ initial, onSave }: Props) {
  const [profile, setProfile] = useState<AllergyProfile>(
    initial ?? { grass: true, tree: true, weed: true }
  );

  function toggle(key: keyof AllergyProfile) {
    setProfile((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    // Ensure at least one is selected — fall back to all true if somehow all deselected
    const anySelected = profile.grass || profile.tree || profile.weed;
    onSave(anySelected ? profile : { grass: true, tree: true, weed: true });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-charcoal-900/50 backdrop-blur-sm" aria-hidden="true" />

      {/* Card */}
      <div className="modal-enter relative w-full max-w-sm bg-[var(--card)] rounded-2xl shadow-xl border border-cream-400 dark:border-charcoal-600 p-7">
        {/* Icon + heading */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-sage-100 dark:bg-sage-900">
            <Leaf className="w-5 h-5 text-sage-600 dark:text-sage-400" />
          </div>
          <h2 className="text-lg font-semibold text-charcoal-800 dark:text-cream-200">
            Your allergy profile
          </h2>
        </div>
        <p className="text-sm text-charcoal-500 dark:text-charcoal-300 mb-6 leading-relaxed">
          Select the pollens that affect you. We&apos;ll use this to personalise your
          antihistamine recommendation.
        </p>

        {/* Toggle tiles */}
        <div className="space-y-2.5 mb-6">
          {POLLEN_TYPES.map(({ key, label, description }) => {
            const selected = profile[key];
            return (
              <button
                key={key}
                onClick={() => toggle(key)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-1 ${
                  selected
                    ? "bg-sage-50 dark:bg-sage-900/60 border-sage-400 dark:border-sage-600"
                    : "bg-cream-100 dark:bg-charcoal-700 border-cream-400 dark:border-charcoal-600 opacity-60"
                }`}
              >
                {selected ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-sage-600 dark:text-sage-400" />
                ) : (
                  <Circle className="w-5 h-5 flex-shrink-0 text-charcoal-300 dark:text-charcoal-500" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-charcoal-800 dark:text-cream-200">{label}</p>
                  <p className="text-xs text-charcoal-400 dark:text-charcoal-400">{description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-sage-600 dark:bg-sage-700 text-white font-semibold text-sm hover:bg-sage-700 dark:hover:bg-sage-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-2"
        >
          Save preferences
        </button>
        <button
          onClick={() => onSave({ grass: true, tree: true, weed: true })}
          className="w-full mt-3 text-sm text-charcoal-400 dark:text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 transition-colors"
        >
          Use defaults (all pollen)
        </button>
      </div>
    </div>
  );
}
