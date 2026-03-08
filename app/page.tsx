"use client";

import { useState } from "react";
import { MapPin, MapPinOff, RefreshCw } from "lucide-react";
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

// Subtle leaf SVG background motif
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
          <path
            d="M70 70 L70 15"
            stroke="#5c7a5f"
            strokeWidth="1.5"
            fill="none"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#leaves)" />
    </svg>
  );
}

export default function Home() {
  const [data, setData] = useState<ConditionsResponse | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function handleRefresh() {
    setData(null);
    setRefreshKey((k) => k + 1);
  }

  if (!data) {
    return <LocationGate key={refreshKey} onData={setData} />;
  }

  return (
    <div className="relative min-h-screen bg-cream-200 overflow-hidden">
      <LeafMotif />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-7">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sage-600 text-sm font-medium mb-1.5">
                <MapPin className="w-3.5 h-3.5" />
                <span>{data.locationName}</span>
              </div>
              <h1 className="text-3xl font-semibold text-charcoal-800 leading-tight">
                {formatDate()}
              </h1>
              <p className="text-charcoal-400 text-sm mt-1">
                Updated at {formatTime(data.fetchedAt)}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-sm text-charcoal-400 hover:text-sage-600 transition-colors px-3 py-2 rounded-lg hover:bg-sage-50"
              aria-label="Refresh conditions"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </header>

        {/* Fallback location notice */}
        {data.usingFallbackLocation && (
          <div className="flex items-center gap-2 text-sm text-clay-700 bg-clay-50 border border-clay-200 rounded-xl px-4 py-2.5 mb-5">
            <MapPinOff className="w-4 h-4 flex-shrink-0" />
            <span>
              Couldn&apos;t access your location — showing conditions for{" "}
              <strong className="font-medium">Ealing, London</strong> instead.
            </span>
          </div>
        )}

        {/* Cards — recommendation hero first, then supporting detail */}
        <div className="space-y-4">
          <RecommendationCard recommendation={data.recommendation} />
          <WeatherCard weather={data.weather} />
          <PollenCard pollen={data.pollen} />
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-charcoal-300 space-y-1">
          <p>
            Weather &amp; pollen data from{" "}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-charcoal-500"
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
              className="underline hover:text-charcoal-500"
            >
              Nominatim
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
