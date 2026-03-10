export interface WeatherData {
  temperature: number;
  feelsLike: number;
  uvIndex: number;
  windSpeed: number;
  windDirection: number;
  precipitationProbability: number;
  weatherCode: number;
  isDay: number;
}

export interface PollenData {
  grassPollen: number | null;
  treePollen: number | null;
  weedPollen: number | null;
}

export type PollenLevel = "None" | "Low" | "Moderate" | "High" | "Very High";

export interface ClothingItem {
  label: string;
  reason: string;
}

export interface Recommendation {
  antihistamine: boolean;
  antihistamineReason: string;
  clothing: ClothingItem[];
}

export interface AllergyProfile {
  grass: boolean;
  tree: boolean;
  weed: boolean;
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  weatherCode: number;
  precipProbability: number;
  grassPollen: number | null;
  treePollen: number | null;
  weedPollen: number | null;
}

export interface ConditionsResponse {
  weather: WeatherData;
  pollen: PollenData;
  recommendation: Recommendation;
  locationName: string;
  fetchedAt: string;
  usingFallbackLocation?: boolean;
  weeklyForecast?: DailyForecast[];
}
