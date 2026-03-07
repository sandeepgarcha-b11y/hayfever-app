import type { WeatherData, PollenData, PollenLevel, Recommendation, ClothingItem } from "./types";

export function getPollenLevel(value: number | null): PollenLevel {
  if (value === null || value === 0) return "None";
  if (value <= 10) return "Low";
  if (value <= 50) return "Moderate";
  if (value <= 200) return "High";
  return "Very High";
}

export function getPollenLevelIndex(level: PollenLevel): number {
  const map: Record<PollenLevel, number> = {
    None: 0,
    Low: 1,
    Moderate: 2,
    High: 3,
    "Very High": 4,
  };
  return map[level];
}

export function getWeatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 84) return "Rain showers";
  if (code <= 94) return "Thunderstorm";
  return "Thunderstorm with hail";
}

export function buildRecommendation(
  weather: WeatherData,
  pollen: PollenData
): Recommendation {
  const grassLevel = getPollenLevel(pollen.grassPollen);
  const treeLevel = getPollenLevel(pollen.treePollen);
  const weedLevel = getPollenLevel(pollen.weedPollen);

  const maxPollenIndex = Math.max(
    getPollenLevelIndex(grassLevel),
    getPollenLevelIndex(treeLevel),
    getPollenLevelIndex(weedLevel)
  );

  const highPollen = maxPollenIndex >= 2; // Moderate or above
  const highUV = weather.uvIndex >= 6;
  const antihistamine = highPollen || highUV;

  const reasons: string[] = [];
  if (highPollen) {
    const highOnes = [
      grassLevel !== "None" && grassLevel !== "Low" ? `grass (${grassLevel})` : null,
      treeLevel !== "None" && treeLevel !== "Low" ? `tree (${treeLevel})` : null,
      weedLevel !== "None" && weedLevel !== "Low" ? `weed (${weedLevel})` : null,
    ].filter(Boolean);
    reasons.push(`pollen levels are elevated: ${highOnes.join(", ")}`);
  }
  if (highUV) reasons.push(`UV index is high (${weather.uvIndex})`);

  const antihistamineReason = antihistamine
    ? `Recommended because ${reasons.join(" and ")}.`
    : "Pollen and UV levels are low — no antihistamine needed today.";

  const clothing: ClothingItem[] = [];

  // Temperature-based layers
  if (weather.temperature < 8) {
    clothing.push({ label: "Warm coat", reason: "Temperature is cold" });
    clothing.push({ label: "Scarf & gloves", reason: "Extra warmth needed" });
  } else if (weather.temperature < 15) {
    clothing.push({ label: "Light jacket or fleece", reason: "Cool conditions" });
  } else if (weather.temperature < 22) {
    clothing.push({ label: "Light layers", reason: "Mild temperature" });
  } else {
    clothing.push({ label: "Light, breathable clothing", reason: "Warm day" });
  }

  // Rain
  if (weather.precipitationProbability >= 40) {
    clothing.push({
      label: "Waterproof jacket or umbrella",
      reason: `${weather.precipitationProbability}% chance of rain`,
    });
  }

  // UV / sun
  if (weather.uvIndex >= 3) {
    clothing.push({ label: "Sunglasses", reason: "UV index is moderate or higher" });
  }
  if (weather.uvIndex >= 6) {
    clothing.push({
      label: "Sun hat & sunscreen",
      reason: `UV index is high (${weather.uvIndex})`,
    });
  }

  // Pollen — long sleeves help reduce skin exposure
  if (maxPollenIndex >= 3) {
    clothing.push({
      label: "Long sleeves",
      reason: "High pollen — reduces skin exposure",
    });
  }

  return { antihistamine, antihistamineReason, clothing };
}
