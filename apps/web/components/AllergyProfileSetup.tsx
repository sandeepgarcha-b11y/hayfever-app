"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Leaf, X } from "lucide-react";
import type { AllergyProfile } from "@hayfever/core";

interface Props {
  initial?: AllergyProfile;
  onSave: (profile: AllergyProfile) => void;
  onCancel: () => void;
}

const POLLEN_TYPES: Array<{ key: keyof AllergyProfile; label: string; description: string }> = [
  { key: "grass",  label: "Grass",  description: "Timothy, rye, meadow grass" },
  { key: "tree",   label: "Tree",   description: "Birch, alder, olive" },
  { key: "weed",   label: "Weed",   description: "Mugwort, ragweed" },
];

export default function AllergyProfileSetup({ initial, onSave, onCancel }: Props) {
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="allergy-profile-title"
        className="modal-enter relative w-full max-w-[min(24rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--card)] rounded-2xl shadow-xl border border-cream-400 dark:border-charcoal-600 p-6 sm:p-7"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close pollen triggers"
          className="absolute right-4 top-4 rounded-lg p-2 text-charcoal-300 transition-colors hover:bg-cream-200 hover:text-charcoal-600 focus:outline-none focus:ring-2 focus:ring-sage-400 dark:text-charcoal-400 dark:hover:bg-charcoal-700 dark:hover:text-cream-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon + heading */}
        <div className="flex items-center gap-3 mb-2 pr-8">
          <div className="p-2 rounded-xl bg-sage-100 dark:bg-sage-900">
            <Leaf className="w-5 h-5 text-sage-600 dark:text-sage-400" />
          </div>
          <h2 id="allergy-profile-title" className="text-lg font-semibold text-charcoal-800 dark:text-cream-200">
            Pollen triggers
          </h2>
        </div>
        <p className="text-sm text-charcoal-500 dark:text-charcoal-300 mb-6 leading-relaxed">
          Choose the pollen types that usually affect you. The dashboard still shows
          all pollen data, but your plan focuses on these triggers.
        </p>

        {/* Toggle tiles */}
        <div className="space-y-2.5 mb-6">
          {POLLEN_TYPES.map(({ key, label, description }) => {
            const selected = profile[key];
            return (
              <button
                type="button"
                key={key}
                onClick={() => toggle(key)}
                aria-pressed={selected}
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
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-sage-600 dark:bg-sage-700 text-white font-semibold text-sm hover:bg-sage-700 dark:hover:bg-sage-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-2"
        >
          Save triggers
        </button>
        <button
          type="button"
          onClick={() => onSave({ grass: true, tree: true, weed: true })}
          className="w-full mt-3 text-sm text-charcoal-400 dark:text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 transition-colors"
        >
          Track all pollen
        </button>
      </div>
    </div>
  );
}
