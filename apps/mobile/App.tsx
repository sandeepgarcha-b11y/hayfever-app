import AsyncStorage from "@react-native-async-storage/async-storage";
import { buildRecommendation, getPollenLevel } from "@hayfever/core";
import type { AllergyProfile, ConditionsResponse } from "@hayfever/core";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
  };
};

const PROFILE_KEY = "hayfever.allergyProfile.v1";
const DEFAULT_PROFILE: AllergyProfile = { grass: true, tree: true, weed: true };

const SAMPLE_CONDITIONS: ConditionsResponse = {
  weather: {
    temperature: 18,
    feelsLike: 17,
    uvIndex: 4,
    windSpeed: 18,
    windDirection: 220,
    precipitationProbability: 30,
    weatherCode: 2,
    isDay: 1,
  },
  pollen: {
    grassPollen: 3,
    treePollen: 1,
    weedPollen: 2,
  },
  recommendation: {
    antihistamine: true,
    antihistamineReason: "Recommended because pollen levels are elevated: grass (moderate).",
    clothing: [
      { label: "Light layers", reason: "Mild feel at 17°C" },
      { label: "Glasses or sunglasses", reason: "Helps reduce pollen reaching your eyes" },
    ],
  },
  locationName: "Sample location",
  fetchedAt: new Date().toISOString(),
  weeklyForecast: [],
};

function normaliseProfile(profile: Partial<AllergyProfile>): AllergyProfile {
  const next = { ...DEFAULT_PROFILE, ...profile };
  return next.grass || next.tree || next.weed ? next : DEFAULT_PROFILE;
}

function formatUpdated(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 2) return "Just updated";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

export default function App() {
  const [conditions, setConditions] = useState<ConditionsResponse>(SAMPLE_CONDITIONS);
  const [profile, setProfile] = useState<AllergyProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Using sample data until the API URL is configured.");

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY)
      .then((saved) => {
        if (saved) setProfile(normaliseProfile(JSON.parse(saved)));
      })
      .catch(() => undefined);
  }, []);

  const personalisedRecommendation = useMemo(
    () => buildRecommendation(conditions.weather, conditions.pollen, profile),
    [conditions.pollen, conditions.weather, profile]
  );

  const refresh = useCallback(async () => {
    if (!apiBaseUrl) {
      setConditions({ ...SAMPLE_CONDITIONS, fetchedAt: new Date().toISOString() });
      setStatus("Using sample data until the API URL is configured.");
      return;
    }

    setLoading(true);
    setStatus("Finding local conditions...");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        throw new Error("Location permission is needed for local pollen conditions.");
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const params = new URLSearchParams({
        lat: String(location.coords.latitude),
        lon: String(location.coords.longitude),
      });

      const response = await fetch(`${apiBaseUrl}/v1/conditions?${params}`);
      if (!response.ok) throw new Error(`API error ${response.status}`);

      const nextConditions = (await response.json()) as ConditionsResponse;
      setConditions(nextConditions);
      setStatus("Live local data");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not refresh conditions.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggleTrigger(key: keyof AllergyProfile) {
    const next = normaliseProfile({ ...profile, [key]: !profile[key] });
    setProfile(next);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }

  const pollenRows = [
    { key: "grass" as const, label: "Grass", value: conditions.pollen.grassPollen },
    { key: "tree" as const, label: "Tree", value: conditions.pollen.treePollen },
    { key: "weed" as const, label: "Weed", value: conditions.pollen.weedPollen },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Hayfever</Text>
          <Text style={styles.title}>Today's allergy plan</Text>
          <Text style={styles.meta}>{conditions.locationName} / {formatUpdated(conditions.fetchedAt)}</Text>
        </View>

        <View style={[styles.card, personalisedRecommendation.antihistamine ? styles.priorityCard : null]}>
          <Text style={styles.cardLabel}>Recommendation</Text>
          <Text style={styles.decision}>
            {personalisedRecommendation.antihistamine ? "Take antihistamine" : "No antihistamine needed"}
          </Text>
          <Text style={styles.bodyText}>{personalisedRecommendation.antihistamineReason}</Text>
          <Pressable style={styles.refreshButton} onPress={refresh} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.refreshText}>Refresh local conditions</Text>}
          </Pressable>
          <Text style={styles.statusText}>{status}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.metricCard}>
            <Text style={styles.cardLabel}>Feels like</Text>
            <Text style={styles.metric}>{conditions.weather.feelsLike}°</Text>
            <Text style={styles.bodyText}>{conditions.weather.precipitationProbability}% rain · UV {conditions.weather.uvIndex}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.cardLabel}>Wind</Text>
            <Text style={styles.metric}>{conditions.weather.windSpeed}</Text>
            <Text style={styles.bodyText}>km/h</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Trigger pollen</Text>
          {pollenRows.map((row) => (
            <View key={row.key} style={styles.pollenRow}>
              <View>
                <Text style={styles.rowTitle}>{row.label}</Text>
                <Text style={styles.bodyText}>{getPollenLevel(row.value)}</Text>
              </View>
              <Switch
                value={profile[row.key]}
                onValueChange={() => toggleTrigger(row.key)}
                trackColor={{ false: "#d0ccc7", true: "#c6d9c7" }}
                thumbColor={profile[row.key] ? "#4a6650" : "#f5f4f3"}
              />
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Wear</Text>
          {personalisedRecommendation.clothing.slice(0, 4).map((item) => (
            <View key={item.label} style={styles.clothingItem}>
              <Text style={styles.rowTitle}>{item.label}</Text>
              <Text style={styles.bodyText}>{item.reason}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#faf7f0",
  },
  container: {
    padding: 20,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  eyebrow: {
    color: "#5c7a5f",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#2d2926",
    fontSize: 30,
    fontWeight: "700",
    marginTop: 6,
  },
  meta: {
    color: "#706860",
    fontSize: 14,
    marginTop: 6,
  },
  card: {
    backgroundColor: "#fffdf9",
    borderColor: "#e5ddd0",
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#2d2926",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  priorityCard: {
    borderColor: "#c6d9c7",
    backgroundColor: "#f7fbf7",
  },
  cardLabel: {
    color: "#8e867c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  decision: {
    color: "#2d2926",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 10,
  },
  bodyText: {
    color: "#706860",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  refreshButton: {
    alignItems: "center",
    backgroundColor: "#4a6650",
    borderRadius: 12,
    marginTop: 16,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  refreshText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  statusText: {
    color: "#8e867c",
    fontSize: 12,
    marginTop: 10,
  },
  grid: {
    flexDirection: "row",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#fffdf9",
    borderColor: "#e5ddd0",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  metric: {
    color: "#2d2926",
    fontSize: 34,
    fontWeight: "800",
    marginTop: 6,
  },
  pollenRow: {
    alignItems: "center",
    borderBottomColor: "#f0ebe0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowTitle: {
    color: "#2d2926",
    fontSize: 16,
    fontWeight: "700",
  },
  clothingItem: {
    borderBottomColor: "#f0ebe0",
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
});
