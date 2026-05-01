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
    antihistamineReason = "Your trigger pollen and UV levels are low — no antihistamine needed today.";
  }

  const clothing: ClothingItem[] = [];
  const addClothing = (item: ClothingItem) => {
    if (!clothing.some((existing) => existing.label === item.label)) {
      clothing.push(item);
    }
  };

  const feelsLike = weather.feelsLike;
  const rainChance = weather.precipitationProbability;
  const windy = weather.windSpeed >= 20;
  const strongWind = weather.windSpeed >= 35;
  const wetWeather = rainChance >= 40 || (weather.weatherCode >= 51 && weather.weatherCode <= 69);
  const snowOrIce = weather.weatherCode >= 71 && weather.weatherCode <= 79;

  // Base outfit: choose the main layer by feels-like temperature, not just air temp.
  if (feelsLike <= 2) {
    addClothing({ label: "Insulated coat", reason: `Feels like ${feelsLike}°C` });
    addClothing({ label: "Hat, scarf & gloves", reason: "Cold exposure will build up quickly" });
  } else if (feelsLike <= 8) {
    addClothing({ label: "Warm coat", reason: `Feels like ${feelsLike}°C` });
    addClothing({ label: "Warm mid-layer", reason: "Useful if you are outside for more than a short walk" });
  } else if (feelsLike <= 14) {
    addClothing({ label: "Jacket or fleece", reason: `Cool feel at ${feelsLike}°C` });
  } else if (feelsLike <= 20) {
    addClothing({ label: "Light layers", reason: `Mild feel at ${feelsLike}°C` });
  } else if (feelsLike <= 25) {
    addClothing({ label: "Breathable top", reason: `Warm feel at ${feelsLike}°C` });
    addClothing({ label: "Light layer to carry", reason: "Useful for shade, evening, or air conditioning" });
  } else {
    addClothing({ label: "Loose, breathable clothing", reason: `Hot feel at ${feelsLike}°C` });
  }

  // Rain and ground conditions.
  if (rainChance >= 70) {
    addClothing({
      label: "Waterproof outer layer",
      reason: `${rainChance}% chance of rain`,
    });
    addClothing({ label: "Water-resistant shoes", reason: "Likely wet ground and pavements" });
  } else if (rainChance >= 40 || wetWeather) {
    addClothing({
      label: "Packable waterproof",
      reason: `${rainChance}% chance of rain`,
    });
  } else if (rainChance >= 20) {
    addClothing({
      label: "Compact umbrella",
      reason: "Small rain risk, low commitment to carry",
    });
  }

  if (snowOrIce) {
    addClothing({ label: "Grip-friendly shoes", reason: "Snow or ice risk in the forecast" });
  }

  // Wind changes how warm the outfit feels and how much pollen moves around.
  if (strongWind) {
    addClothing({ label: "Windproof outer layer", reason: `${weather.windSpeed} km/h winds` });
  } else if (windy) {
    addClothing({ label: "Wind-resistant layer", reason: `${weather.windSpeed} km/h breeze` });
  }

  // UV and pollen protection overlap around eyes, skin, and hair.
  if (weather.uvIndex >= 3 && maxPollenIndex >= 2) {
    addClothing({ label: "Sunglasses", reason: "Helps with UV and keeps pollen out of your eyes" });
  } else if (weather.uvIndex >= 3) {
    addClothing({ label: "Sunglasses", reason: "UV index is moderate or higher" });
  } else if (maxPollenIndex >= 2) {
    addClothing({ label: "Glasses or sunglasses", reason: "Helps reduce pollen reaching your eyes" });
  }

  if (weather.uvIndex >= 6) {
    addClothing({
      label: "Sun hat & sunscreen",
      reason: `UV index is high (${weather.uvIndex})`,
    });
  }

  if (maxPollenIndex >= 3) {
    addClothing({
      label: "Long sleeves",
      reason: "High trigger pollen — reduces skin and fabric exposure",
    });
  } else if (maxPollenIndex >= 2) {
    addClothing({
      label: "Smooth outer layer",
      reason: "Moderate trigger pollen — easier to shake off after being outside",
    });
  }

  if (windyHighPollen) {
    addClothing({
      label: "Hat or tied-back hair",
      reason: "Wind can carry pollen into hair and around your face",
    });
  }

  return { antihistamine, antihistamineReason, clothing };
}
