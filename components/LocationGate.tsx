"use client";

import { useState, useEffect, useCallback } from "react";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import type { ConditionsResponse } from "@/lib/types";

interface Props {
  onData: (data: ConditionsResponse) => void;
}

type State =
  | { status: "idle" }
  | { status: "requesting" }
  | { status: "fetching"; coords: GeolocationCoordinates }
  | { status: "error"; message: string }
  | { status: "done" };

export default function LocationGate({ onData }: Props) {
  const [state, setState] = useState<State>({ status: "idle" });

  const fetchConditions = useCallback(async (coords: GeolocationCoordinates) => {
    setState({ status: "fetching", coords });
    try {
      const res = await fetch(
        `/api/conditions?lat=${coords.latitude}&lon=${coords.longitude}`
      );
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: ConditionsResponse = await res.json();
      onData(data);
      setState({ status: "done" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to load conditions",
      });
    }
  }, [onData]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: "error", message: "Geolocation is not supported by your browser." });
      return;
    }
    setState({ status: "requesting" });
    navigator.geolocation.getCurrentPosition(
      (pos) => fetchConditions(pos.coords),
      (err) => {
        const messages: Record<number, string> = {
          1: "Location access was denied. Please allow location access and try again.",
          2: "Your location could not be determined.",
          3: "Location request timed out.",
        };
        setState({ status: "error", message: messages[err.code] ?? "Unknown location error." });
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, [fetchConditions]);

  // Auto-request on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  if (state.status === "done") return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="max-w-sm w-full mx-4 text-center">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            {state.status === "requesting" || state.status === "fetching" ? (
              <Loader2 className="w-9 h-9 text-green-700 animate-spin" />
            ) : state.status === "error" ? (
              <AlertTriangle className="w-9 h-9 text-amber-600" />
            ) : (
              <MapPin className="w-9 h-9 text-green-700" />
            )}
          </div>

          <h1 className="text-2xl font-semibold text-stone-800 mb-2">
            {state.status === "requesting" && "Finding your location…"}
            {state.status === "fetching" && "Loading conditions…"}
            {state.status === "error" && "Location needed"}
            {state.status === "idle" && "Hayfever Dashboard"}
          </h1>

          <p className="text-stone-500 text-sm leading-relaxed">
            {state.status === "requesting" &&
              "Please allow location access in your browser."}
            {state.status === "fetching" &&
              "Fetching weather and pollen data for your area."}
            {state.status === "error" && (state as { status: "error"; message: string }).message}
            {state.status === "idle" &&
              "We need your location to show local weather and pollen conditions."}
          </p>
        </div>

        {(state.status === "idle" || state.status === "error") && (
          <button
            onClick={requestLocation}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-700 text-white font-medium hover:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            <MapPin className="w-4 h-4" />
            {state.status === "error" ? "Try again" : "Use my location"}
          </button>
        )}
      </div>
    </div>
  );
}
