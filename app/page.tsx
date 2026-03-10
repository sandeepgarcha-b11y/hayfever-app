"use client";

import { useState, useEffect } from "react";
import { MapPin, MapPinOff, RefreshCw, Sun, Moon } from "lucide-react";
import LocationGate from "@/components/LocationGate";
import WeatherCard from "@/components/WeatherCard";
import PollenCard from "@/components/PollenCard";
import RecommendationCard from "@/components/RecommendationCard";
import type { ConditionsResponse } from "@/lib/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
      className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none select-none"
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
      {/* Track icons */}
      <Sun className="absolute left-1.5 w-3.5 h-3.5 text-clay-400 transition-opacity duration-200" style={{ opacity: dark ? 0.4 : 1 }} />
      <Moon className="absolute right-1.5 w-3.5 h-3.5 text-sage-400 transition-opacity duration-200" style={{ opacity: dark ? 1 : 0.4 }} />
      {/* Thumb */}
      <span
        className={`
          absolute w-5 h-5 rounded-full shadow-sm transition-all duration-300
          ${dark ? "translate-x-7 bg-charcoal-200" : "translate-x-1 bg-white"}
        `}
      />
    </button>
  );
}

export default function Home() {
  const [data, setData] = useState<ConditionsResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dark, setDark] = useState(false);

  // Initialise from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  function handleRefresh() {
    setData(null);
    setRefreshKey((k) => k + 1);
  }

  if (!data) {
    return <LocationGate key={refreshKey} onData={setData} darkToggle={<DarkModeToggle dark={dark} onToggle={toggleDark} />} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
      <LeafMotif />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sage-600 dark:text-sage-400 text-sm font-medium mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{data.locationName}</span>
              </div>
              <h1 className="text-3xl font-semibold text-charcoal-800 dark:text-cream-200 leading-tight">
                {formatDate()}
              </h1>
              <p className="text-charcoal-400 dark:text-charcoal-300 text-sm mt-1">
                Updated at {formatTime(data.fetchedAt)}
              </p>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <DarkModeToggle dark={dark} onToggle={toggleDark} />
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 text-sm text-charcoal-400 dark:text-charcoal-300 hover:text-sage-600 dark:hover:text-sage-400 transition-colors px-3 py-2 rounded-lg hover:bg-sage-50 dark:hover:bg-charcoal-700"
                aria-label="Refresh conditions"
              >
                <RefreshCw className="w-4 h-4" />
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

        {/* Cards */}
        <div className="space-y-4">
          <RecommendationCard recommendation={data.recommendation} />
          <WeatherCard weather={data.weather} />
          <PollenCard pollen={data.pollen} />
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
    </div>
  );
}
