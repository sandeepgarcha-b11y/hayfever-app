"use client";

import { useEffect, useState } from "react";

interface Props {
  weatherCode: number;
  isDay: number;
  highPollen: boolean;
}

type WeatherMood = "sunny" | "night" | "rain" | "snow" | "storm" | "overcast";

function getMood(code: number, isDay: number): WeatherMood {
  if (isDay === 0) return "night";
  if (code <= 1) return "sunny";
  if (code <= 3) return "overcast";
  if (code >= 95) return "storm";
  if (code >= 71 && code <= 86) return "snow";
  if (code >= 45) return "rain";
  return "overcast";
}

export default function WeatherBackground({ weatherCode, isDay, highPollen }: Props) {
  const [reducedMotion, setReducedMotion] = useState(true); // SSR-safe default

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const mood = getMood(weatherCode, isDay);
  const animate = !reducedMotion;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      <style>{`
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.04; transform: scale(1); }
          50%       { opacity: 0.09; transform: scale(1.06); }
        }
        @keyframes night-glow {
          0%, 100% { opacity: 0.05; }
          50%       { opacity: 0.10; }
        }
        @keyframes rain-fall {
          from { background-position: 0 0; }
          to   { background-position: -80px 200px; }
        }
        @keyframes mist-drift {
          0%   { transform: translateX(-4%); opacity: 0.04; }
          50%  { transform: translateX( 4%); opacity: 0.08; }
          100% { transform: translateX(-4%); opacity: 0.04; }
        }
        @keyframes snow-fall {
          0%   { transform: translateY(-20px) translateX(0);   opacity: 0; }
          10%  { opacity: 0.7; }
          90%  { opacity: 0.7; }
          100% { transform: translateY(100vh) translateX(12px); opacity: 0; }
        }
        @keyframes pollen-rise {
          0%   { transform: translateY(0)     scale(1);   opacity: 0; }
          10%  { opacity: 0.55; }
          90%  { opacity: 0.55; }
          100% { transform: translateY(-80vh) scale(0.7); opacity: 0; }
        }
      `}</style>

      {/* ── SUNNY glow ── */}
      {mood === "sunny" && (
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-amber-200 dark:bg-amber-800 blur-3xl"
          style={{ animation: animate ? "glow-pulse 9s ease-in-out infinite" : "none", opacity: 0.06 }}
        />
      )}

      {/* ── NIGHT glow ── */}
      {mood === "night" && (
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[320px] rounded-full bg-indigo-900 dark:bg-indigo-950 blur-3xl"
          style={{ animation: animate ? "night-glow 12s ease-in-out infinite" : "none", opacity: 0.07 }}
        />
      )}

      {/* ── OVERCAST mist ── */}
      {mood === "overcast" && (
        <>
          <div
            className="absolute top-[15%] -left-[20%] w-[70%] h-44 bg-cream-300 dark:bg-charcoal-500 rounded-full blur-3xl"
            style={{ animation: animate ? "mist-drift 14s ease-in-out infinite" : "none", opacity: 0.06 }}
          />
          <div
            className="absolute top-[45%] -right-[20%] w-[60%] h-32 bg-cream-400 dark:bg-charcoal-600 rounded-full blur-3xl"
            style={{ animation: animate ? "mist-drift 18s ease-in-out infinite reverse" : "none", opacity: 0.05 }}
          />
        </>
      )}

      {/* ── RAIN streaks ── */}
      {(mood === "rain" || mood === "storm") && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(108deg, transparent, transparent 14px, rgba(100,116,139,0.12) 14px, rgba(100,116,139,0.12) 15px)",
            animation: animate ? "rain-fall 0.55s linear infinite" : "none",
          }}
        />
      )}

      {/* ── SNOW particles ── */}
      {mood === "snow" && animate && (
        <>
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-cream-50 dark:bg-charcoal-100"
              style={{
                left: `${i * 10 + 5}%`,
                top: 0,
                opacity: 0,
                animation: `snow-fall ${5 + (i % 4)}s linear infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </>
      )}

      {/* ── POLLEN particles (overlay on any mood when pollen is high) ── */}
      {highPollen && animate && (
        <>
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500"
              style={{
                left: `${8 + i * 10}%`,
                bottom: "5%",
                opacity: 0,
                animation: `pollen-rise ${7 + (i % 5) * 1.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.9}s`,
              }}
            />
          ))}
        </>
      )}
    </div>
  );
}
