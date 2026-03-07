"use client";

import { useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
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
      className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none select-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="leaves" width="120" height="120" patternUnits="userSpaceOnUse">
          <path
            d="M20 60 Q60 10 100 60 Q60 110 20 60Z"
            fill="#3d6b3a"
          />
          <path
            d="M60 60 L60 10"
            stroke="#3d6b3a"
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
    <div className="relative min-h-screen bg-stone-50 overflow-hidden">
      <LeafMotif />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-green-700 text-sm font-medium mb-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{data.locationName}</span>
              </div>
              <h1 className="text-3xl font-semibold text-stone-800 leading-tight">
                {formatDate()}
              </h1>
              <p className="text-stone-400 text-sm mt-1">
                Updated at {formatTime(data.fetchedAt)}
              </p>
            </div>

            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-green-700 transition-colors px-3 py-2 rounded-lg hover:bg-green-50"
              aria-label="Refresh conditions"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </header>

        {/* Cards */}
        <div className="space-y-4">
          <WeatherCard weather={data.weather} />
          <PollenCard pollen={data.pollen} />
          <RecommendationCard recommendation={data.recommendation} />
        </div>

        {/* Footer */}
        <footer className="mt-10 text-center text-xs text-stone-400 space-y-1">
          <p>Weather &amp; pollen data from{" "}
            <a
              href="https://open-meteo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-600"
            >
              Open-Meteo
            </a>
          </p>
          <p>Location from browser geolocation · Reverse geocoding by{" "}
            <a
              href="https://nominatim.org"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-600"
            >
              Nominatim
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
