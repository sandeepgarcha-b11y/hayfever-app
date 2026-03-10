"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import type { ConditionsResponse } from "@/lib/types";

interface Props {
  onData: (data: ConditionsResponse) => void;
  darkToggle?: React.ReactNode;
}

const FALLBACK = { lat: 51.513, lon: -0.3089, label: "Ealing, London" };

type State =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "fetching" }
  | { status: "fallback-fetching" }
  | { status: "error"; message: string }
  | { status: "done" };

export default function LocationGate({ onData, darkToggle }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  const fetchConditions = useCallback(
    async (lat: number, lon: number, isFallback = false) => {
      setState(isFallback ? { status: "fallback-fetching" } : { status: "fetching" });
      try {
        const res = await fetch(`/api/conditions?lat=${lat}&lon=${lon}`);
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? `Server error ${res.status}`);
        }
        const data: ConditionsResponse = await res.json();
        if (isFallback) data.usingFallbackLocation = true;
        onData(data);
        setState({ status: "done" });
      } catch (err) {
        if (!isFallback) {
          fetchConditions(FALLBACK.lat, FALLBACK.lon, true);
        } else {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load conditions",
          });
        }
      }
    },
    [onData]
  );

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      fetchConditions(FALLBACK.lat, FALLBACK.lon, true);
      return;
    }
    setState({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchConditions(pos.coords.latitude, pos.coords.longitude, false),
      () => fetchConditions(FALLBACK.lat, FALLBACK.lon, true),
      { timeout: 10000, maximumAge: 300000 }
    );
  }, [fetchConditions]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  if (state.status === "done") return null;

  const isLoading =
    state.status === "requesting" ||
    state.status === "fetching" ||
    state.status === "fallback-fetching";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)" }}>
      {/* Toggle in top-right corner */}
      {darkToggle && (
        <div className="flex justify-end p-4">
          {darkToggle}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-sm w-full mx-4 text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-sage-100 dark:bg-charcoal-700 mb-5">
              {isLoading ? (
                <Loader2 className="w-9 h-9 text-sage-600 dark:text-sage-400 animate-spin" />
              ) : state.status === "error" ? (
                <AlertTriangle className="w-9 h-9 text-clay-500 dark:text-clay-400" />
              ) : (
                <MapPin className="w-9 h-9 text-sage-600 dark:text-sage-400" />
              )}
            </div>

            <h1 className="text-2xl font-semibold text-charcoal-800 dark:text-cream-200 mb-2">
              {state.status === "requesting" && "Finding your location…"}
              {state.status === "fetching" && "Loading conditions…"}
              {state.status === "fallback-fetching" && "Loading conditions…"}
              {state.status === "error" && "Something went wrong"}
              {state.status === "idle" && "Hayfever Dashboard"}
            </h1>

            <p className="text-charcoal-500 dark:text-charcoal-300 text-sm leading-relaxed">
              {state.status === "requesting" && "Please allow location access in your browser."}
              {state.status === "fetching" && "Fetching weather and pollen data for your area."}
              {state.status === "fallback-fetching" && (
                <>
                  Couldn&apos;t access your location.{" "}
                  <span className="text-charcoal-400 dark:text-charcoal-400">
                    Loading data for {FALLBACK.label} instead.
                  </span>
                </>
              )}
              {state.status === "error" && (state as { status: "error"; message: string }).message}
              {state.status === "idle" && "We need your location to show local weather and pollen conditions."}
            </p>
          </div>

          {(state.status === "idle" || state.status === "error") && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={requestLocation}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sage-600 dark:bg-sage-700 text-white font-medium hover:bg-sage-700 dark:hover:bg-sage-600 transition-colors focus:outline-none focus:ring-2 focus:ring-sage-400 focus:ring-offset-2"
              >
                <MapPin className="w-4 h-4" />
                {state.status === "error" ? "Try again" : "Use my location"}
              </button>
              {state.status === "error" && (
                <button
                  onClick={() => fetchConditions(FALLBACK.lat, FALLBACK.lon, true)}
                  className="text-sm text-charcoal-400 dark:text-charcoal-400 hover:text-charcoal-600 dark:hover:text-charcoal-200 underline transition-colors"
                >
                  Use {FALLBACK.label} instead
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
