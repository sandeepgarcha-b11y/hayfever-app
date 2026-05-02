import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  buildRecommendation,
  getPollenLevel,
  getPollenLevelIndex,
  getWeatherDescription,
} from "@hayfever/core";
import type {
  AllergyProfile,
  ClothingCategory,
  ClothingItem,
  ConditionsResponse,
  DailyForecast,
  PollenData,
  PollenLevel,
} from "@hayfever/core";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type DataState = "sample" | "loading" | "live" | "stale" | "permission" | "error";
type TriggerKey = keyof AllergyProfile;

const PROFILE_KEY = "hayfever.allergyProfile.v1";
const PROFILE_COMPLETE_KEY = "hayfever.profileComplete.v1";
const DEFAULT_PROFILE: AllergyProfile = { grass: true, tree: true, weed: true };
const STALE_AFTER_MINUTES = 90;

const TRIGGER_COPY: Array<{ key: TriggerKey; label: string; detail: string }> = [
  { key: "grass", label: "Grass", detail: "Lawns, parks, open fields" },
  { key: "tree", label: "Tree", detail: "Birch, oak, plane and spring pollen" },
  { key: "weed", label: "Weed", detail: "Late-season and roadside pollen" },
];

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
      {
        label: "Light layers",
        reason: "Mild feel at 17°C",
        category: "wear",
        priority: "primary",
      },
      {
        label: "Glasses or sunglasses",
        reason: "Helps reduce pollen reaching your eyes",
        category: "protect",
        priority: "primary",
      },
      {
        label: "Compact umbrella",
        reason: "Small rain risk, low commitment to carry",
        category: "carry",
      },
    ],
  },
  locationName: "Sample location",
  fetchedAt: new Date().toISOString(),
  weeklyForecast: [
    { date: "2026-05-01", maxTemp: 18, weatherCode: 2, precipProbability: 30, grassPollen: 3, treePollen: 1, weedPollen: 2 },
    { date: "2026-05-02", maxTemp: 20, weatherCode: 61, precipProbability: 50, grassPollen: 2, treePollen: 2, weedPollen: 1 },
    { date: "2026-05-03", maxTemp: 17, weatherCode: 3, precipProbability: 35, grassPollen: 2, treePollen: 1, weedPollen: 1 },
    { date: "2026-05-04", maxTemp: 19, weatherCode: 0, precipProbability: 10, grassPollen: 4, treePollen: 1, weedPollen: 2 },
    { date: "2026-05-05", maxTemp: 21, weatherCode: 2, precipProbability: 20, grassPollen: 3, treePollen: 1, weedPollen: 1 },
  ],
};

const RISK_TONE: Record<PollenLevel, { background: string; border: string; text: string; accent: string }> = {
  None: { background: "#eef3ee", border: "#d9e4dc", text: "#2e4c3b", accent: "#5d856d" },
  Low: { background: "#eef3ee", border: "#d9e4dc", text: "#2e4c3b", accent: "#5d856d" },
  Moderate: { background: "#fff4df", border: "#efd6aa", text: "#6d481a", accent: "#d78a2f" },
  High: { background: "#ffece6", border: "#edbfaf", text: "#7a3425", accent: "#c55a3f" },
  "Very High": { background: "#f7e9ee", border: "#e7bac9", text: "#713145", accent: "#b84d6d" },
};

function normaliseProfile(profile: Partial<AllergyProfile>): AllergyProfile {
  const next = { ...DEFAULT_PROFILE, ...profile };
  return next.grass || next.tree || next.weed ? next : DEFAULT_PROFILE;
}

function profileWithToggledTrigger(profile: AllergyProfile, key: TriggerKey): AllergyProfile {
  const next = { ...profile, [key]: !profile[key] };
  return next.grass || next.tree || next.weed ? next : profile;
}

function formatUpdated(iso: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 2) return "Just updated";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

function isStale(iso: string) {
  return Date.now() - new Date(iso).getTime() > STALE_AFTER_MINUTES * 60_000;
}

function getPollenValue(pollen: PollenData | DailyForecast, key: TriggerKey) {
  if (key === "grass") return pollen.grassPollen;
  if (key === "tree") return pollen.treePollen;
  return pollen.weedPollen;
}

function getTriggerRisk(pollen: PollenData | DailyForecast, profile: AllergyProfile) {
  const activeRows = TRIGGER_COPY.filter((trigger) => profile[trigger.key]).map((trigger) => {
    const level = getPollenLevel(getPollenValue(pollen, trigger.key));
    return {
      ...trigger,
      level,
      index: getPollenLevelIndex(level),
    };
  });

  const dominant = activeRows.reduce(
    (best, row) => (row.index > best.index ? row : best),
    activeRows[0] ?? { key: "grass" as const, label: "Grass", detail: "", level: "None" as PollenLevel, index: 0 }
  );

  return {
    dominant,
    level: dominant.level,
    index: dominant.index,
    activeRows,
  };
}

function formatForecastDay(date: string, index: number) {
  if (index === 0) return "Today";
  const parsed = new Date(`${date}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(parsed);
}

function inferCategory(item: ClothingItem): ClothingCategory {
  if (item.category) return item.category;
  const label = item.label.toLowerCase();
  if (label.includes("umbrella") || label.includes("carry") || label.includes("packable")) return "carry";
  if (label.includes("sunglasses") || label.includes("glasses") || label.includes("hat") || label.includes("sunscreen")) {
    return "protect";
  }
  return "wear";
}

function groupClothing(items: ClothingItem[]) {
  const groups: Record<ClothingCategory, ClothingItem[]> = {
    wear: [],
    carry: [],
    protect: [],
  };

  items.forEach((item) => {
    groups[inferCategory(item)].push(item);
  });

  Object.values(groups).forEach((group) => {
    group.sort((a, b) => {
      if (a.priority === b.priority) return a.label.localeCompare(b.label);
      if (a.priority === "primary") return -1;
      if (b.priority === "primary") return 1;
      return 0;
    });
  });

  return groups;
}

function getStateCopy(state: DataState, conditions: ConditionsResponse) {
  if (state === "live" && isStale(conditions.fetchedAt)) {
    return {
      label: "Stale",
      detail: `Last live update ${formatUpdated(conditions.fetchedAt)}`,
      tone: styles.statusWarning,
    };
  }

  if (state === "live") {
    return {
      label: "Live",
      detail: `${conditions.locationName} / ${formatUpdated(conditions.fetchedAt)}`,
      tone: styles.statusLive,
    };
  }

  if (state === "loading") {
    return {
      label: "Updating",
      detail: "Fetching local pollen and weather",
      tone: styles.statusNeutral,
    };
  }

  if (state === "permission") {
    return {
      label: "Location off",
      detail: "Local pollen needs device location",
      tone: styles.statusWarning,
    };
  }

  if (state === "stale") {
    return {
      label: "Stale",
      detail: `Last live update ${formatUpdated(conditions.fetchedAt)}`,
      tone: styles.statusWarning,
    };
  }

  if (state === "error") {
    return {
      label: "Offline",
      detail: "Using sample conditions",
      tone: styles.statusError,
    };
  }

  return {
    label: "Sample",
    detail: "Live API not configured",
    tone: styles.statusNeutral,
  };
}

function TriggerSelector({
  profile,
  values,
  onToggle,
  compact = false,
}: {
  profile: AllergyProfile;
  values?: PollenData;
  onToggle: (key: TriggerKey) => void;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.triggerListCompact : styles.triggerList}>
      {TRIGGER_COPY.map((trigger) => {
        const enabled = profile[trigger.key];
        const level = values ? getPollenLevel(getPollenValue(values, trigger.key)) : null;
        return (
          <View key={trigger.key} style={[styles.triggerRow, enabled ? styles.triggerRowActive : null]}>
            <View style={styles.triggerText}>
              <Text style={styles.rowTitle}>{trigger.label}</Text>
              <Text style={styles.mutedText}>{level ? `${level} today` : trigger.detail}</Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={() => onToggle(trigger.key)}
              trackColor={{ false: "#d5d9d2", true: "#a9cfc0" }}
              thumbColor={enabled ? "#2f6f5e" : "#f8faf7"}
            />
          </View>
        );
      })}
    </View>
  );
}

function OnboardingScreen({
  profile,
  onToggle,
  onComplete,
}: {
  profile: AllergyProfile;
  onToggle: (key: TriggerKey) => void;
  onComplete: () => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.onboardingContainer}>
        <View>
          <Text style={styles.brand}>Hayfever</Text>
          <Text style={styles.onboardingTitle}>Build a plan around your triggers.</Text>
          <Text style={styles.onboardingCopy}>
            Choose the pollen types that matter to you. Your daily plan will ignore the rest.
          </Text>
        </View>

        <TriggerSelector profile={profile} onToggle={onToggle} />

        <Pressable style={styles.primaryButton} onPress={onComplete}>
          <Text style={styles.primaryButtonText}>Create today's plan</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ClothingSection({ title, items }: { title: string; items: ClothingItem[] }) {
  if (!items.length) return null;

  return (
    <View style={styles.clothingSection}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <View key={`${title}-${item.label}`} style={styles.clothingItem}>
          <View style={item.priority === "primary" ? styles.priorityDot : styles.secondaryDot} />
          <View style={styles.clothingText}>
            <Text style={styles.rowTitle}>{item.label}</Text>
            <Text style={styles.mutedText}>{item.reason}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ForecastStrip({
  forecast,
  profile,
}: {
  forecast: DailyForecast[];
  profile: AllergyProfile;
}) {
  if (!forecast.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.forecastRow}
    >
      {forecast.slice(0, 5).map((day, index) => {
        const risk = getTriggerRisk(day, profile);
        const tone = RISK_TONE[risk.level];
        return (
          <View key={day.date} style={styles.forecastDay}>
            <Text style={styles.forecastDate}>{formatForecastDay(day.date, index)}</Text>
            <Text style={styles.forecastTemp}>{day.maxTemp}°</Text>
            <Text style={styles.forecastWeather} numberOfLines={1}>
              {getWeatherDescription(day.weatherCode)}
            </Text>
            <View style={[styles.forecastBadge, { backgroundColor: tone.background, borderColor: tone.border }]}>
              <Text style={[styles.forecastBadgeText, { color: tone.text }]}>{risk.level}</Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

export default function App() {
  const [conditions, setConditions] = useState<ConditionsResponse>(SAMPLE_CONDITIONS);
  const [profile, setProfile] = useState<AllergyProfile>(DEFAULT_PROFILE);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dataState, setDataState] = useState<DataState>("sample");
  const hasLiveDataRef = useRef(false);

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  useEffect(() => {
    let mounted = true;

    Promise.all([AsyncStorage.getItem(PROFILE_KEY), AsyncStorage.getItem(PROFILE_COMPLETE_KEY)])
      .then(([savedProfile, complete]) => {
        if (!mounted) return;
        if (savedProfile) setProfile(normaliseProfile(JSON.parse(savedProfile) as Partial<AllergyProfile>));
        const ready = complete === "true" || Boolean(savedProfile);
        setProfileReady(ready);
        setProfileOpen(!ready);
      })
      .catch(() => {
        if (!mounted) return;
        setProfileReady(false);
        setProfileOpen(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const personalisedRecommendation = useMemo(
    () => buildRecommendation(conditions.weather, conditions.pollen, profile),
    [conditions.pollen, conditions.weather, profile]
  );

  const triggerRisk = useMemo(() => getTriggerRisk(conditions.pollen, profile), [conditions.pollen, profile]);
  const riskTone = RISK_TONE[triggerRisk.level];
  const clothingGroups = useMemo(
    () => groupClothing(personalisedRecommendation.clothing),
    [personalisedRecommendation.clothing]
  );
  const status = getStateCopy(dataState, conditions);

  const saveProfile = useCallback(async (nextProfile: AllergyProfile) => {
    setProfile(nextProfile);
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
  }, []);

  const toggleTrigger = useCallback(
    async (key: TriggerKey) => {
      const next = profileWithToggledTrigger(profile, key);
      await saveProfile(next);
    },
    [profile, saveProfile]
  );

  const refresh = useCallback(async () => {
    if (!apiBaseUrl) {
      hasLiveDataRef.current = false;
      setConditions({ ...SAMPLE_CONDITIONS, fetchedAt: new Date().toISOString() });
      setDataState("sample");
      return;
    }

    setDataState("loading");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setDataState("permission");
        return;
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
      hasLiveDataRef.current = true;
      setDataState("live");
    } catch {
      setDataState(hasLiveDataRef.current ? "stale" : "error");
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    if (profileReady) refresh();
  }, [profileReady, refresh]);

  const completeProfile = useCallback(async () => {
    await AsyncStorage.multiSet([
      [PROFILE_KEY, JSON.stringify(profile)],
      [PROFILE_COMPLETE_KEY, "true"],
    ]);
    setProfileReady(true);
    setProfileOpen(false);
  }, [profile]);

  if (profileReady === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator color="#2f6f5e" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profileReady) {
    return <OnboardingScreen profile={profile} onToggle={toggleTrigger} onComplete={completeProfile} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Hayfever</Text>
            <Text style={styles.title}>Today</Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => setProfileOpen((open) => !open)}>
            <Text style={styles.secondaryButtonText}>{profileOpen ? "Done" : "Triggers"}</Text>
          </Pressable>
        </View>

        {profileOpen ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Allergy profile</Text>
            <Text style={styles.cardTitle}>Relevant pollens only</Text>
            <TriggerSelector profile={profile} values={conditions.pollen} onToggle={toggleTrigger} compact />
          </View>
        ) : null}

        <View style={[styles.heroCard, { backgroundColor: riskTone.background, borderColor: riskTone.border }]}>
          <View style={styles.heroTopRow}>
            <View style={[styles.statusPill, status.tone]}>
              {dataState === "loading" ? <ActivityIndicator size="small" color="#315242" /> : null}
              <Text style={styles.statusPillText}>{status.label}</Text>
            </View>
            <Text style={styles.updatedText}>{status.detail}</Text>
          </View>

          <Text style={[styles.riskLabel, { color: riskTone.text }]}>
            {triggerRisk.level === "None" ? "No trigger pollen" : `${triggerRisk.level} ${triggerRisk.dominant.label.toLowerCase()} pollen`}
          </Text>
          <Text style={styles.decision}>
            {personalisedRecommendation.antihistamine ? "Take antihistamine today" : "No antihistamine needed"}
          </Text>
          <Text style={styles.bodyText}>{personalisedRecommendation.antihistamineReason}</Text>

          <View style={styles.heroMetrics}>
            <View style={styles.heroMetric}>
              <Text style={styles.metricLabel}>Feels</Text>
              <Text style={styles.metricValue}>{conditions.weather.feelsLike}°</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.metricLabel}>Rain</Text>
              <Text style={styles.metricValue}>{conditions.weather.precipitationProbability}%</Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.metricLabel}>Wind</Text>
              <Text style={styles.metricValue}>{conditions.weather.windSpeed}</Text>
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={refresh} disabled={dataState === "loading"}>
            {dataState === "loading" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>Refresh local conditions</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardLabel}>Trigger pollen</Text>
              <Text style={styles.cardTitle}>What matters today</Text>
            </View>
            <Text style={[styles.inlineBadge, { color: riskTone.text, backgroundColor: riskTone.background }]}>
              {triggerRisk.level}
            </Text>
          </View>
          {triggerRisk.activeRows.map((row) => (
            <View key={row.key} style={styles.pollenRow}>
              <View>
                <Text style={styles.rowTitle}>{row.label}</Text>
                <Text style={styles.mutedText}>{row.detail}</Text>
              </View>
              <Text style={styles.pollenValue}>{row.level}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Outfit</Text>
          <Text style={styles.cardTitle}>What to wear outside</Text>
          <ClothingSection title="Wear" items={clothingGroups.wear} />
          <ClothingSection title="Carry" items={clothingGroups.carry} />
          <ClothingSection title="Protect" items={clothingGroups.protect} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>5-day outlook</Text>
          <Text style={styles.cardTitle}>Plan the week</Text>
          <ForecastStrip forecast={conditions.weeklyForecast ?? []} profile={profile} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4f7f2",
  },
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  onboardingContainer: {
    flex: 1,
    gap: 22,
    justifyContent: "center",
    padding: 22,
  },
  container: {
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  brand: {
    color: "#2f6f5e",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#1f2a24",
    fontSize: 32,
    fontWeight: "800",
    marginTop: 2,
  },
  onboardingTitle: {
    color: "#1f2a24",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    marginTop: 10,
  },
  onboardingCopy: {
    color: "#59675f",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#dfe7df",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#1f2a24",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  heroCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 15,
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusLive: {
    backgroundColor: "#dfeee6",
  },
  statusWarning: {
    backgroundColor: "#fff0d6",
  },
  statusError: {
    backgroundColor: "#f7dedd",
  },
  statusNeutral: {
    backgroundColor: "#e8ece5",
  },
  statusPillText: {
    color: "#315242",
    fontSize: 12,
    fontWeight: "800",
  },
  updatedText: {
    color: "#526159",
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
  riskLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    marginTop: 18,
    textTransform: "uppercase",
  },
  decision: {
    color: "#1f2a24",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 32,
    marginTop: 8,
  },
  bodyText: {
    color: "#435249",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  heroMetric: {
    backgroundColor: "rgba(255,255,255,0.58)",
    borderColor: "rgba(49,82,66,0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 10,
  },
  metricLabel: {
    color: "#627068",
    fontSize: 12,
    fontWeight: "700",
  },
  metricValue: {
    color: "#1f2a24",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 3,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2f6f5e",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderColor: "#dfe7df",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#2f6f5e",
    fontSize: 13,
    fontWeight: "800",
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  cardLabel: {
    color: "#748078",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#1f2a24",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    marginTop: 4,
  },
  inlineBadge: {
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  triggerList: {
    gap: 10,
  },
  triggerListCompact: {
    gap: 7,
    marginTop: 12,
  },
  triggerRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#dfe7df",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 12,
  },
  triggerRowActive: {
    backgroundColor: "#edf6ef",
    borderColor: "#bfd9c8",
  },
  triggerText: {
    flex: 1,
  },
  pollenRow: {
    alignItems: "center",
    borderBottomColor: "#edf1eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 11,
  },
  pollenValue: {
    color: "#1f2a24",
    fontSize: 14,
    fontWeight: "800",
  },
  rowTitle: {
    color: "#1f2a24",
    fontSize: 15,
    fontWeight: "800",
  },
  mutedText: {
    color: "#637168",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  clothingSection: {
    marginTop: 14,
  },
  sectionTitle: {
    color: "#2f6f5e",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 4,
  },
  clothingItem: {
    alignItems: "flex-start",
    borderBottomColor: "#edf1eb",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
  },
  clothingText: {
    flex: 1,
  },
  priorityDot: {
    backgroundColor: "#2f6f5e",
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  secondaryDot: {
    backgroundColor: "#d78a2f",
    borderRadius: 4,
    height: 8,
    marginTop: 6,
    width: 8,
  },
  forecastRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingRight: 2,
  },
  forecastDay: {
    backgroundColor: "#f8faf7",
    borderColor: "#e1e8df",
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 118,
    padding: 10,
    width: 112,
  },
  forecastDate: {
    color: "#516158",
    fontSize: 12,
    fontWeight: "800",
  },
  forecastTemp: {
    color: "#1f2a24",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4,
  },
  forecastWeather: {
    color: "#637168",
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  forecastBadge: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  forecastBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
});
