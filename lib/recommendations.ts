import type { WeatherData, PollenData, PollenLevel, Recommendation, ClothingItem, AllergyProfile } from "./types";

export function getPollenLevel(value: number | null): PollenLevel {
  // Google Pollen API returns a Universal Pollen Index (UPI) on a 0–5 scale:
  // 0 = none, 1 = very low, 2 = low, 3 = moderate, 4 = high, 5 = very high
  if (value === null || value === 0) return "None";
  if (value <= 2) return "Low";
  if (value === 3) return "Moderate";
  if (value === 4) return "High";
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
  pollen: PollenData,
  allergyProfile?: AllergyProfile
): Recommendation {
  const profile: AllergyProfile = allergyProfile ?? { grass: true, tree: true, weed: true };

  // Only consider pollens the user is actually allergic to
  const grassLevel = profile.grass ? getPollenLevel(pollen.grassPollen) : "None";
  const treeLevel  = profile.tree  ? getPollenLevel(pollen.treePollen)  : "None";
  const weedLevel  = profile.weed  ? getPollenLevel(pollen.weedPollen)  : "None";

  const maxPollenIndex = Math.max(
    getPollenLevelIndex(grassLevel),
    getPollenLevelIndex(treeLevel),
    getPollenLevelIndex(weedLevel)
  );

  const highPollen = maxPollenIndex >= 2; // Moderate or above
  const highUV = weather.uvIndex >= 6;
  const windyHighPollen = weather.windSpeed >= 20 && maxPollenIndex >= 2;

  const antihistamine = highPollen || highUV;

  const reasons: string[] = [];
  if (highPollen) {
    const highOnes = [
      profile.grass && grassLevel !== "None" && grassLevel !== "Low" ? `grass (${grassLevel.toLowerCase()})` : null,
      profile.tree  && treeLevel  !== "None" && treeLevel  !== "Low" ? `tree (${treeLevel.toLowerCase()})`  : null,
      profile.weed  && weedLevel  !== "None" && weedLevel  !== "Low" ? `weed (${weedLevel.toLowerCase()})`  : null,
    ].filter(Boolean);
    if (highOnes.length > 0) reasons.push(`pollen levels are elevated: ${highOnes.join(", ")}`);
  }
  if (highUV) reasons.push(`UV index is high (${weather.uvIndex})`);

  let antihistamineReason: string;
  if (antihistamine) {
    antihistamineReason = `Recommended because ${reasons.join(" and ")}.`;
    if (windyHighPollen) {
      antihistamineReason += ` Windy conditions (${weather.windSpeed} km/h) will spread pollen further — exposure risk is higher than usual.`;
    }
  } else {
    antihistamineReason = "Pollen and UV levels are low — no antihistamine needed today.";
  }

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
