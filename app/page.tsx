"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { MapPin, MapPinOff, RefreshCw, Sun, Moon, SlidersHorizontal, Leaf } from "lucide-react";
import LocationGate from "@/components/LocationGate";
import WeatherCard from "@/components/WeatherCard";
import PollenCard from "@/components/PollenCard";
import RecommendationCard from "@/components/RecommendationCard";
import WeeklyOutlook from "@/components/WeeklyOutlook";
import WeatherBackground from "@/components/WeatherBackground";
import AllergyProfileSetup from "@/components/AllergyProfileSetup";
import { buildRecommendation, getPollenLevel, getPollenLevelIndex } from "@/lib/recommendations";
import type { ConditionsResponse, AllergyProfile } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): { label: string; stale: boolean } {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const stale = diffMin >= 120;

  if (diffMin < 2) return { label: "Just updated", stale };
  if (diffMin < 60) return { label: `${diffMin} min ago`, stale };
  const hrs = Math.floor(diffMin / 60);
  return { label: `${hrs} hr ago`, stale };
}

function formatDate() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function LeafMotif() {
  return (
    <svg
      className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none select-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="leaves" width="140" height="140" patternUnits="userSpaceOnUse">
          <path d="M25 70 Q70 15 115 70 Q70 125 25 70Z" fill="#5c7a5f" />
          <path d="M70 70 L70 15" stroke="#5c7a5f" strokeWidth="1.5" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaves)" />
    </svg>
  );
}

function DarkModeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`
        relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-2
        ${dark ? "bg-charcoal-700 focus:ring-offset-charcoal-900" : "bg-cream-400 focus:ring-offset-cream-200"}
      `}
    >
      <Sun  className="absolute left-1.5 w-3.5 h-3.5 text-clay-400 transition-opacity duration-200"  style={{ opacity: dark ? 0.4 : 1 }} />
      <Moon className="absolute right-1.5 w-3.5 h-3.5 text-sage-400 transition-opacity duration-200" style={{ opacity: dark ? 1 : 0.4 }} />
      <span
        className={`
          absolute w-5 h-5 rounded-full shadow-sm transition-all duration-300
          ${dark ? "translate-x-7 bg-charcoal-200" : "translate-x-1 bg-white"}
        `}
      />
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [data, setData]             = useState<ConditionsResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dark, setDark]             = useState(false);
  const [allergyProfile, setAllergyProfile] = useState<AllergyProfile | null>(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);

  // Initialise theme from localStorage on mount
  useEffect(() => {
    const saved       = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark      = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  // Initialise allergy profile from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("allergyProfile");
    if (saved) {
      try {
        setAllergyProfile(JSON.parse(saved));
      } catch {
        setShowProfileSetup(true);
      }
    } else {
      setShowProfileSetup(true);
    }
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleRefresh() {
    if (isRefreshing) return;

    // If we have coords from the initial fetch, refresh in-place
    if (coordsRef.current) {
      setIsRefreshing(true);
      try {
        const { lat, lon } = coordsRef.current;
        const res = await fetch(`/api/conditions?lat=${lat}&lon=${lon}`);
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const newData: ConditionsResponse = await res.json();
        if (data?.usingFallbackLocation) newData.usingFallbackLocation = true;
        setData(newData);
      } catch {
        // silently keep existing data on failure
      } finally {
        setIsRefreshing(false);
      }
    } else {
      // No coords yet (initial load failed) — fall back to full remount
      setData(null);
      setRefreshKey((k) => k + 1);
    }
  }

  function handleSaveProfile(profile: AllergyProfile) {
    setAllergyProfile(profile);
    localStorage.setItem("allergyProfile", JSON.stringify(profile));
    setShowProfileSetup(false);
  }

  // Compute personalised recommendation client-side using the allergy profile
  const recommendation = useMemo(() => {
    if (!data) return null;
    return allergyProfile
      ? buildRecommendation(data.weather, data.pollen, allergyProfile)
      : data.recommendation;
  }, [data, allergyProfile]);

  // Determine if pollen is objectively high (for WeatherBackground — not profile-filtered)
  const rawPollenHigh = useMemo(() => {
    if (!data) return false;
    const levels = [data.pollen.grassPollen, data.pollen.treePollen, data.pollen.weedPollen]
      .map(getPollenLevel)
      .map(getPollenLevelIndex);
    return Math.max(...levels) >= 3; // High or Very High
  }, [data]);

  if (!data || !recommendation) {
    return (
      <LocationGate
        key={refreshKey}
        onData={setData}
        onLocation={(lat, lon) => { coordsRef.current = { lat, lon }; }}
        darkToggle={<DarkModeToggle dark={dark} onToggle={toggleDark} />}
      />
    );
  }

  const { label: updatedLabel, stale } = relativeTime(data.fetchedAt);

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      {/* Ambient weather background — behind leaf motif */}
      <WeatherBackground
        weatherCode={data.weather.weatherCode}
        isDay={data.weather.isDay}
        highPollen={rawPollenHigh}
      />

      {/* Leaf texture */}
      <LeafMotif />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-7">
          <div className="flex items-start justify-between">
            <div>
              {/* App identity eyebrow */}
              <div className="flex items-center gap-1 text-sage-500 dark:text-sage-500 text-[10px] font-semibold uppercase tracking-[0.15em] mb-1">
                <Leaf className="w-2.5 h-2.5" />
                <span>Hayfever</span>
              </div>

              {/* Location */}
              <div className="flex items-center gap-1.5 text-sage-600 dark:text-sage-400 text-sm font-medium mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{data.locationName}</span>
              </div>

              {/* Date */}
              <h1 className="text-3xl font-semibold text-charcoal-800 dark:text-cream-200 leading-tight">
                {formatDate()}
              </h1>

              {/* Updated timestamp — amber tint when stale */}
              <p className={`text-sm mt-1 transition-colors ${
                stale
                  ? "text-clay-500 dark:text-clay-400"
                  : "text-charcoal-400 dark:text-charcoal-300"
              }`}>
                {stale && <span className="inline-block w-1.5 h-1.5 rounded-full bg-clay-400 mr-1.5 align-middle" />}
                {updatedLabel}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1">
              {/* Allergens button — icon + label */}
              <button
                onClick={() => setShowProfileSetup(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-charcoal-400 dark:text-charcoal-400 hover:text-sage-600 dark:hover:text-sage-400 hover:bg-sage-50 dark:hover:bg-charcoal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-sage-400"
                aria-label="Edit allergy profile"
              >
                <SlidersHorizontal className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs font-medium">Allergens</span>
              </button>

              <DarkModeToggle dark={dark} onToggle={toggleDark} />

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 text-sm text-charcoal-400 dark:text-charcoal-300 hover:text-sage-600 dark:hover:text-sage-400 transition-colors px-3 py-2 rounded-lg hover:bg-sage-50 dark:hover:bg-charcoal-700 disabled:opacity-50"
                aria-label="Refresh conditions"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Fallback location notice */}
        {data.usingFallbackLocation && (
          <div className="flex items-center gap-2 text-sm text-clay-700 dark:text-clay-300 bg-clay-50 dark:bg-charcoal-700 border border-clay-200 dark:border-charcoal-600 rounded-xl px-4 py-2.5 mb-5">
            <MapPinOff className="w-4 h-4 flex-shrink-0" />
            <span>
              Couldn&apos;t access your location — showing conditions for{" "}
              <strong className="font-medium">Ealing, London</strong> instead.
            </span>
          </div>
        )}

        {/* Cards — staggered entrance animation */}
        <div className="space-y-4">
          <div className="card-enter" style={{ animationDelay: "0ms" }}>
            <RecommendationCard recommendation={recommendation} />
          </div>
          <div className="card-enter" style={{ animationDelay: "80ms" }}>
            <WeatherCard weather={data.weather} />
          </div>
          <div className="card-enter" style={{ animationDelay: "160ms" }}>
            <PollenCard pollen={data.pollen} />
          </div>
          {data.weeklyForecast && data.weeklyForecast.length > 0 && (
            <div className="card-enter" style={{ animationDelay: "240ms" }}>
              <WeeklyOutlook forecasts={data.weeklyForecast} allergyProfile={allergyProfile} />
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-charcoal-300 dark:text-charcoal-500 space-y-1">
          <p>
            Weather &amp; pollen data from{" "}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-charcoal-500 dark:hover:text-charcoal-300"
            >
              Open-Meteo
            </a>
          </p>
          <p>
            Location from browser geolocation · Reverse geocoding by{" "}
            <a
              href="https://nominatim.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-charcoal-500 dark:hover:text-charcoal-300"
            >
              Nominatim
            </a>
          </p>
        </footer>
      </div>

      {/* Allergy profile setup modal */}
      {showProfileSetup && (
        <AllergyProfileSetup
          initial={allergyProfile ?? undefined}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}
