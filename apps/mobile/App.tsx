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
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Leaf,
  MapPin,
  Pill,
  RefreshCw,
  Shirt,
  SlidersHorizontal,
  Sun,
  Umbrella,
  UserRound,
  Wind,
  Zap,
} from "lucide-react-native";
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
type ActiveTab = "today" | "outlook" | "profile";

const PROFILE_KEY = "hayfever.allergyProfile.v1";
const PROFILE_COMPLETE_KEY = "hayfever.profileComplete.v1";
const DEFAULT_PROFILE: AllergyProfile = { grass: true, tree: true, weed: true };

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

const RISK_TONE: Record<
  PollenLevel,
  {
    background: string;
    border: string;
    text: string;
    accent: string;
    hero: [string, string];
    track: string;
    progress: number;
  }
> = {
  None: {
    background: "#eef3ee",
    border: "#d9e4dc",
    text: "#2e4c3b",
    accent: "#5d856d",
    hero: ["#fefcf8", "#eaf2eb"],
    track: "#e8e6e3",
    progress: 0,
  },
  Low: {
    background: "#e4ece4",
    border: "#c6d9c7",
    text: "#3b5240",
    accent: "#5c7a5f",
    hero: ["#fefcf8", "#e4ece4"],
    track: "#e8e6e3",
    progress: 0.25,
  },
  Moderate: {
    background: "#faeade",
    border: "#f4d0b5",
    text: "#854a28",
    accent: "#c97a45",
    hero: ["#fffaf3", "#faeade"],
    track: "#f0dfcf",
    progress: 0.5,
  },
  High: {
    background: "#f4d0b5",
    border: "#ecb188",
    text: "#5e331c",
    accent: "#a86035",
    hero: ["#fff4ec", "#f4d0b5"],
    track: "#ecd2bd",
    progress: 0.75,
  },
  "Very High": {
    background: "#f4d0b5",
    border: "#c97a45",
    text: "#3d2011",
    accent: "#854a28",
    hero: ["#fff0e2", "#ecb188"],
    track: "#e7c0a2",
    progress: 1,
  },
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

function formatToday() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date()).replace(",", "");
}

function formatLocationName(locationName: string) {
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(locationName.trim())) return "Current location";
  return locationName;
}

function compassDirection(deg: number) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv: number) {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very high";
  return "Extreme";
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

function getBannerCopy(state: DataState) {
  if (state === "permission") return "Location unavailable - showing sample conditions";
  if (state === "error") return "Live data unavailable - showing sample conditions";
  if (state === "stale") return "Refresh failed - showing last live conditions";
  if (state === "sample") return "Using sample conditions until live data is available";
  return null;
}

function WeatherIcon({ code, color = "#c97a45", size = 22 }: { code: number; color?: string; size?: number }) {
  if (code <= 1) return <Sun size={size} color={color} strokeWidth={2.2} />;
  if (code <= 3) return <Cloud size={size} color={color} strokeWidth={2.2} />;
  if (code <= 69) return <CloudRain size={size} color={color} strokeWidth={2.2} />;
  if (code <= 79) return <CloudSnow size={size} color={color} strokeWidth={2.2} />;
  if (code <= 84) return <CloudRain size={size} color={color} strokeWidth={2.2} />;
  return <Zap size={size} color={color} strokeWidth={2.2} />;
}

function AmbientBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={["#fbfaf7", "#f4f0ea"]} style={StyleSheet.absoluteFillObject} />
    </View>
  );
}

function IconBadge({
  children,
  backgroundColor,
  borderColor,
}: {
  children: ReactNode;
  backgroundColor: string;
  borderColor?: string;
}) {
  return (
    <View style={[styles.iconBadge, { backgroundColor, borderColor: borderColor ?? "rgba(255,255,255,0.7)" }]}>
      {children}
    </View>
  );
}

function PlanStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <View style={styles.planStat}>
      <View style={styles.planStatLabelRow}>
        {icon}
        <Text style={styles.planStatLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.planStatValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PollenProgressRow({
  label,
  detail,
  value,
  tracked,
  compact = false,
}: {
  label: string;
  detail: string;
  value: number | null;
  tracked: boolean;
  compact?: boolean;
}) {
  const level = getPollenLevel(value);
  const tone = RISK_TONE[level];

  return (
    <View style={[styles.pollenProgressRow, tracked ? null : styles.pollenRowMuted]}>
      <View style={styles.pollenProgressTop}>
        <View style={styles.pollenProgressCopy}>
          <Text style={compact ? styles.pollenMiniTitle : styles.rowTitle}>{label}</Text>
          {compact ? null : <Text style={styles.mutedText}>{tracked ? detail : "Not in your allergy profile"}</Text>}
        </View>
        {compact ? (
          <Text style={styles.pollenMiniValue}>{level}</Text>
        ) : (
          <Text style={[styles.inlineBadge, { color: tone.text, backgroundColor: tone.background }]}>
            {level}
            {value !== null && value > 0 ? ` ${Math.round(value)}` : ""}
          </Text>
        )}
      </View>
      <View style={[styles.progressTrack, { backgroundColor: tone.track }]}>
        <View style={[styles.progressFill, { backgroundColor: tone.accent, width: `${tone.progress * 100}%` }]} />
      </View>
    </View>
  );
}

function WeatherSummaryCard({ conditions }: { conditions: ConditionsResponse }) {
  const { weather } = conditions;

  return (
    <View style={styles.supportCard}>
      <View style={styles.supportCardTop}>
        <Text style={styles.cardLabel}>Weather</Text>
        <WeatherIcon code={weather.weatherCode} size={22} color="#c97a45" />
      </View>
      <View style={styles.compactTemperatureRow}>
        <Text style={styles.compactTemperatureValue}>{weather.temperature}°</Text>
        <Text style={styles.compactTemperatureUnit}>C</Text>
      </View>
      <Text style={styles.supportMuted}>{getWeatherDescription(weather.weatherCode)}</Text>
      <Text style={styles.supportMuted}>Feels {weather.feelsLike}°</Text>
      <View style={styles.supportList}>
        <View style={styles.supportMetricRow}>
          <Droplets size={14} color="#5c7a5f" strokeWidth={2.3} />
          <Text style={styles.supportMetricText}>{weather.precipitationProbability}% rain</Text>
        </View>
        <View style={styles.supportMetricRow}>
          <Wind size={14} color="#706860" strokeWidth={2.3} />
          <Text style={styles.supportMetricText}>
            {weather.windSpeed} km/h {compassDirection(weather.windDirection)}
          </Text>
        </View>
        <View style={styles.supportMetricRow}>
          <Sun size={14} color="#c97a45" strokeWidth={2.3} />
          <Text style={styles.supportMetricText}>{uvLabel(weather.uvIndex)} UV</Text>
        </View>
      </View>
    </View>
  );
}

function PollenSummaryCard({
  pollen,
  profile,
  risk,
  onEdit,
}: {
  pollen: PollenData;
  profile: AllergyProfile;
  risk: ReturnType<typeof getTriggerRisk>;
  onEdit: () => void;
}) {
  const tone = RISK_TONE[risk.level];

  return (
    <View style={styles.supportCard}>
      <View style={styles.supportCardTop}>
        <Text style={styles.cardLabel}>Pollen</Text>
        <IconBadge backgroundColor={risk.level === "None" ? "#eef3ee" : tone.background} borderColor={tone.border}>
          <Leaf size={18} color={tone.accent} strokeWidth={2.4} />
        </IconBadge>
      </View>
      <Text style={[styles.inlineBadge, styles.supportBadge, { color: tone.text, backgroundColor: tone.background }]}>
        {risk.level}
      </Text>
      <Text style={styles.supportMuted}>trigger level</Text>
      <View style={styles.pollenMiniList}>
        {TRIGGER_COPY.map((row) => (
          <PollenProgressRow
            key={row.key}
            label={row.label}
            detail={row.detail}
            value={getPollenValue(pollen, row.key)}
            tracked={profile[row.key]}
            compact
          />
        ))}
      </View>
      <Pressable style={styles.editTriggersLink} onPress={onEdit}>
        <Text style={styles.editTriggersText}>Edit triggers</Text>
        <ChevronRight size={13} color="#8e867c" strokeWidth={2.4} />
      </Pressable>
    </View>
  );
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

function ClothingSection({ title, items, compact = false }: { title: string; items: ClothingItem[]; compact?: boolean }) {
  if (!items.length) return null;

  const isCarry = title === "Carry";
  const isProtect = title === "Protect";
  const icon = isCarry ? (
    <Umbrella size={17} color="#854a28" strokeWidth={2.3} />
  ) : isProtect ? (
    <CheckCircle2 size={17} color="#5c7a5f" strokeWidth={2.3} />
  ) : (
    <Shirt size={17} color="#5c7a5f" strokeWidth={2.3} />
  );

  return (
    <View style={compact ? styles.compactClothingSection : styles.clothingSection}>
      {compact ? (
        title === "Wear" ? null : (
          <Text style={styles.compactSectionLabel}>{title}</Text>
        )
      ) : (
        <View style={styles.sectionHeaderRow}>
          <IconBadge backgroundColor={isCarry ? "#faeade" : "#e4ece4"} borderColor={isCarry ? "#f4d0b5" : "#c6d9c7"}>
            {icon}
          </IconBadge>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
      )}
      {items.map((item) => (
        <View
          key={`${title}-${item.label}`}
          style={[
            compact ? styles.compactClothingItem : styles.clothingItem,
            item.priority === "primary" && !compact ? styles.primaryClothingItem : null,
          ]}
        >
          <View style={[styles.priorityDot, item.priority === "primary" ? null : styles.secondaryDot]} />
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
        const forecastGradient: [string, string] = index === 0 ? tone.hero : ["#fefcf8", "#faf7f0"];
        return (
          <LinearGradient key={day.date} colors={forecastGradient} style={[styles.forecastDay, { borderColor: index === 0 ? tone.border : "#e5ddd0" }]}>
            <View style={styles.forecastTopRow}>
              <Text style={styles.forecastDate}>{formatForecastDay(day.date, index)}</Text>
              <WeatherIcon code={day.weatherCode} size={18} color="#c97a45" />
            </View>
            <Text style={styles.forecastTemp}>{day.maxTemp}°</Text>
            <Text style={styles.forecastWeather} numberOfLines={1}>
              {getWeatherDescription(day.weatherCode)}
            </Text>
            <View style={styles.forecastRainRow}>
              <Droplets size={12} color="#706860" strokeWidth={2.2} />
              <Text style={styles.forecastRainText}>{day.precipProbability}%</Text>
            </View>
            <View style={[styles.forecastBadge, { backgroundColor: tone.background, borderColor: tone.border }]}>
              <Text style={[styles.forecastBadgeText, { color: tone.text }]}>{risk.level}</Text>
            </View>
          </LinearGradient>
        );
      })}
    </ScrollView>
  );
}

function BottomTabBar({
  activeTab,
  onChange,
}: {
  activeTab: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}) {
  const tabs: Array<{ key: ActiveTab; label: string; icon: (active: boolean) => ReactNode }> = [
    {
      key: "today",
      label: "Today",
      icon: (active) => <Leaf size={22} color={active ? "#111111" : "#8a8a8a"} strokeWidth={2.4} />,
    },
    {
      key: "outlook",
      label: "Outlook",
      icon: (active) => <CalendarDays size={22} color={active ? "#111111" : "#8a8a8a"} strokeWidth={2.4} />,
    },
    {
      key: "profile",
      label: "Profile",
      icon: (active) => <UserRound size={22} color={active ? "#111111" : "#8a8a8a"} strokeWidth={2.4} />,
    },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(tab.key)}
            style={styles.tabButton}
          >
            {tab.icon(active)}
            <Text style={[styles.tabLabel, active ? styles.tabLabelActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function App() {
  const [conditions, setConditions] = useState<ConditionsResponse>(SAMPLE_CONDITIONS);
  const [profile, setProfile] = useState<AllergyProfile>(DEFAULT_PROFILE);
  const [profileReady, setProfileReady] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
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
      })
      .catch(() => {
        if (!mounted) return;
        setProfileReady(false);
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
  const trackedTriggers = useMemo(
    () => TRIGGER_COPY.filter((trigger) => profile[trigger.key]).map((trigger) => trigger.label),
    [profile]
  );
  const bannerCopy = getBannerCopy(dataState);

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
    setActiveTab("today");
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

  const screenTitle = activeTab === "today" ? "Today" : activeTab === "outlook" ? "Outlook" : "Profile";
  const screenSubhead = activeTab === "profile" ? "Allergy settings" : formatToday();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <AmbientBackground />
      <View style={styles.appShell}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <View style={styles.brandRow}>
                <Leaf size={14} color="#5c7a5f" strokeWidth={2.4} />
                <Text style={styles.brand}>Hayfever</Text>
              </View>
              <Text style={styles.title}>{screenTitle}</Text>
              <Text style={styles.dateText}>{screenSubhead}</Text>
              <View style={styles.dateLocationRow}>
                {activeTab === "profile" ? (
                  <SlidersHorizontal size={12} color="#8e867c" strokeWidth={2.2} />
                ) : (
                  <MapPin size={12} color="#8e867c" strokeWidth={2.2} />
                )}
                <Text style={styles.locationText} numberOfLines={1}>
                  {activeTab === "profile" ? `Tracking ${trackedTriggers.join(", ")}` : formatLocationName(conditions.locationName)}
                </Text>
              </View>
              {activeTab === "profile" ? null : <Text style={styles.updatedCaption}>{formatUpdated(conditions.fetchedAt)}</Text>}
            </View>
            {activeTab === "profile" ? null : (
              <View style={styles.headerActions}>
                <Pressable style={styles.iconButton} onPress={refresh} disabled={dataState === "loading"} accessibilityLabel="Refresh conditions">
                  {dataState === "loading" ? (
                    <ActivityIndicator color="#5c7a5f" />
                  ) : (
                    <RefreshCw size={19} color="#5c7a5f" strokeWidth={2.4} />
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {activeTab !== "profile" && bannerCopy ? (
            <View style={styles.statusBanner}>
              <MapPin size={15} color="#854a28" strokeWidth={2.3} />
              <Text style={styles.statusBannerText}>{bannerCopy}</Text>
            </View>
          ) : null}

          {activeTab === "today" ? (
            <LinearGradient colors={riskTone.hero} style={[styles.heroCard, { borderColor: riskTone.border }]}>
              <Text style={styles.cardLabel}>Today's plan</Text>
              <View style={styles.planIntro}>
                <IconBadge backgroundColor={riskTone.background} borderColor={riskTone.border}>
                  <Pill size={23} color={riskTone.accent} strokeWidth={2.35} />
                </IconBadge>
                <View style={styles.planCopy}>
                  <View style={styles.decisionRow}>
                    <Text style={styles.decision}>
                      {personalisedRecommendation.antihistamine ? "Take an antihistamine" : "No antihistamine needed"}
                    </Text>
                    <CheckCircle2 size={16} color={riskTone.accent} strokeWidth={2.2} />
                  </View>
                  <Text style={[styles.riskLabel, { color: riskTone.text }]}>
                    {triggerRisk.level === "None" ? "No trigger pollen" : `${triggerRisk.level} ${triggerRisk.dominant.label.toLowerCase()} pollen`}
                  </Text>
                </View>
              </View>
              <Text style={styles.bodyText}>{personalisedRecommendation.antihistamineReason}</Text>

              <View style={styles.planStatRow}>
                <PlanStat
                  icon={<Leaf size={15} color={riskTone.accent} strokeWidth={2.3} />}
                  label="Pollen"
                  value={triggerRisk.level}
                />
                <PlanStat
                  icon={<CloudSun size={15} color="#c97a45" strokeWidth={2.3} />}
                  label="Feels"
                  value={`${conditions.weather.feelsLike}°C`}
                />
                <PlanStat
                  icon={<Droplets size={15} color="#5c7a5f" strokeWidth={2.3} />}
                  label="Rain"
                  value={`${conditions.weather.precipitationProbability}%`}
                />
              </View>

              <View style={styles.planOutfit}>
                <View style={styles.outfitHeader}>
                  <Shirt size={15} color="#8e867c" strokeWidth={2.3} />
                  <Text style={styles.cardLabel}>Wear</Text>
                </View>
                <ClothingSection title="Wear" items={clothingGroups.wear} compact />
                <ClothingSection title="Carry" items={clothingGroups.carry} compact />
                <ClothingSection title="Protect" items={clothingGroups.protect} compact />
              </View>
            </LinearGradient>
          ) : null}

          {activeTab === "outlook" ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardLabel}>5-day outlook</Text>
                    <Text style={styles.cardTitle}>Plan the week</Text>
                  </View>
                  <IconBadge backgroundColor="#faeade" borderColor="#f4d0b5">
                    <CloudSun size={18} color="#c97a45" strokeWidth={2.4} />
                  </IconBadge>
                </View>
                <ForecastStrip forecast={conditions.weeklyForecast ?? []} profile={profile} />
              </View>

              <View style={styles.supportingGrid}>
                <WeatherSummaryCard conditions={conditions} />
                <PollenSummaryCard
                  pollen={conditions.pollen}
                  profile={profile}
                  risk={triggerRisk}
                  onEdit={() => setActiveTab("profile")}
                />
              </View>
            </>
          ) : null}

          {activeTab === "profile" ? (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardLabel}>Allergy profile</Text>
                    <Text style={styles.cardTitle}>Relevant pollens only</Text>
                  </View>
                  <IconBadge backgroundColor="#e4ece4" borderColor="#c6d9c7">
                    <SlidersHorizontal size={18} color="#5c7a5f" strokeWidth={2.4} />
                  </IconBadge>
                </View>
                <Text style={styles.sectionCopy}>
                  Choose the pollens you react to. The daily plan ignores anything switched off.
                </Text>
                <TriggerSelector profile={profile} values={conditions.pollen} onToggle={toggleTrigger} compact />
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardLabel}>Today</Text>
                    <Text style={styles.cardTitle}>Tracked pollen</Text>
                  </View>
                  <IconBadge backgroundColor={riskTone.background} borderColor={riskTone.border}>
                    <Leaf size={18} color={riskTone.accent} strokeWidth={2.4} />
                  </IconBadge>
                </View>
                <View style={styles.pollenProgressList}>
                  {TRIGGER_COPY.map((row) => (
                    <PollenProgressRow
                      key={row.key}
                      label={row.label}
                      detail={row.detail}
                      value={getPollenValue(conditions.pollen, row.key)}
                      tracked={profile[row.key]}
                    />
                  ))}
                </View>
              </View>
            </>
          ) : null}
        </ScrollView>
        <BottomTabBar activeTab={activeTab} onChange={setActiveTab} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fbfaf7",
  },
  appShell: {
    flex: 1,
  },
  ambientGlow: {
    borderRadius: 999,
    opacity: 0.18,
    position: "absolute",
  },
  ambientGlowTop: {
    height: 220,
    left: -140,
    top: -220,
    width: 560,
  },
  ambientGlowSide: {
    height: 240,
    opacity: 0.1,
    right: -130,
    top: 330,
    width: 300,
  },
  leafMotif: {
    opacity: 0.018,
    position: "absolute",
  },
  leafMotifOne: {
    right: -32,
    top: 190,
    transform: [{ rotate: "28deg" }],
  },
  leafMotifTwo: {
    bottom: 110,
    left: -30,
    transform: [{ rotate: "-22deg" }],
  },
  pollenDust: {
    height: 56,
    left: 0,
    opacity: 0.5,
    position: "absolute",
    right: 0,
    top: 104,
  },
  pollenDot: {
    backgroundColor: "#ecb188",
    borderRadius: 4,
    height: 8,
    opacity: 0.5,
    position: "absolute",
    width: 8,
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
    gap: 14,
    padding: 18,
    paddingBottom: 24,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingTop: 4,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 3,
  },
  dateLocationRow: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(254,252,248,0.72)",
    borderColor: "rgba(229,221,208,0.88)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    marginTop: 7,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  locationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  locationText: {
    color: "#8e867c",
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  brand: {
    color: "#5c7a5f",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#2d2926",
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -0.5,
    lineHeight: 43,
  },
  dateText: {
    color: "#5a5249",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
  },
  updatedCaption: {
    color: "#8e867c",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5,
  },
  onboardingTitle: {
    color: "#2d2926",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
    marginTop: 10,
  },
  onboardingCopy: {
    color: "#706860",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e8e4de",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#2d2926",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 14,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    padding: 18,
    shadowColor: "#2d2926",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  statusBanner: {
    alignItems: "center",
    backgroundColor: "#fdf6f0",
    borderColor: "#f4d0b5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  statusBannerText: {
    color: "#854a28",
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
  },
  heroTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusLive: {
    backgroundColor: "#e4ece4",
  },
  statusWarning: {
    backgroundColor: "#faeade",
  },
  statusError: {
    backgroundColor: "#f4d0b5",
  },
  statusNeutral: {
    backgroundColor: "#e8e6e3",
  },
  statusPillText: {
    color: "#3b5240",
    fontSize: 12,
    fontWeight: "800",
  },
  updatedText: {
    color: "#706860",
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "right",
  },
  planIntro: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    marginTop: 13,
  },
  planCopy: {
    flex: 1,
    minWidth: 0,
  },
  riskLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  decision: {
    color: "#2d2926",
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 22,
  },
  decisionRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  bodyText: {
    color: "#5a5249",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    paddingLeft: 50,
  },
  planStatRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  planStat: {
    backgroundColor: "#ffffff",
    borderRadius: 15,
    flex: 1,
    minHeight: 55,
    padding: 8,
  },
  planStatLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  planStatLabel: {
    color: "#706860",
    flex: 1,
    fontSize: 9,
    fontWeight: "700",
  },
  planStatValue: {
    color: "#2d2926",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 5,
  },
  planOutfit: {
    borderTopColor: "rgba(93,133,109,0.16)",
    borderTopWidth: 1,
    marginHorizontal: -18,
    marginTop: 16,
    paddingHorizontal: 18,
    paddingTop: 13,
  },
  outfitHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#5c7a5f",
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 14,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#fefcf8",
    borderColor: "#e5ddd0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 11,
    shadowColor: "#2d2926",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  secondaryButtonText: {
    color: "#5c7a5f",
    fontSize: 13,
    fontWeight: "800",
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(254,252,248,0.86)",
    borderColor: "rgba(217,208,195,0.88)",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    shadowColor: "#2d2926",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    width: 44,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  cardHeaderRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  cardLabel: {
    color: "#8e867c",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  cardTitle: {
    color: "#2d2926",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
    marginTop: 5,
  },
  inlineBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  weatherCard: {
    backgroundColor: "#fefcf8",
    borderColor: "#e5ddd0",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#2d2926",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
  },
  supportingGrid: {
    flexDirection: "row",
    gap: 12,
  },
  supportCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e8e4de",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 178,
    padding: 13,
    shadowColor: "#2d2926",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
  },
  supportCardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  compactTemperatureRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 4,
    marginTop: 12,
  },
  compactTemperatureValue: {
    color: "#2d2926",
    fontSize: 34,
    fontWeight: "300",
    lineHeight: 38,
  },
  compactTemperatureUnit: {
    color: "#8e867c",
    fontSize: 16,
    fontWeight: "700",
    paddingBottom: 5,
  },
  supportMuted: {
    color: "#706860",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  supportList: {
    gap: 6,
    marginTop: "auto",
    paddingTop: 12,
  },
  supportMetricRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  supportMetricText: {
    color: "#5a5249",
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
  },
  supportBadge: {
    alignSelf: "flex-start",
    marginTop: 13,
  },
  pollenMiniList: {
    gap: 8,
    marginTop: 10,
  },
  pollenMiniTitle: {
    color: "#2d2926",
    fontSize: 12,
    fontWeight: "800",
  },
  pollenMiniValue: {
    color: "#3b5240",
    fontSize: 11,
    fontWeight: "800",
  },
  editTriggersLink: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: "auto",
    minHeight: 30,
    paddingTop: 8,
  },
  editTriggersText: {
    color: "#8e867c",
    fontSize: 11,
    fontWeight: "700",
  },
  weatherCardTop: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  temperatureRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  temperatureValue: {
    color: "#2d2926",
    fontSize: 62,
    fontWeight: "300",
    letterSpacing: -1,
    lineHeight: 66,
  },
  temperatureMeta: {
    paddingBottom: 10,
  },
  temperatureUnit: {
    color: "#8e867c",
    fontSize: 20,
    fontWeight: "700",
  },
  weatherStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  triggerList: {
    gap: 10,
  },
  triggerListCompact: {
    gap: 9,
    marginTop: 16,
  },
  triggerRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e8e4de",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    padding: 13,
  },
  triggerRowActive: {
    backgroundColor: "#e4ece4",
    borderColor: "#c6d9c7",
  },
  triggerText: {
    flex: 1,
  },
  pollenProgressList: {
    gap: 15,
    marginTop: 18,
  },
  pollenProgressRow: {
    gap: 9,
  },
  pollenProgressTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  pollenProgressCopy: {
    flex: 1,
    minWidth: 0,
  },
  pollenRowMuted: {
    opacity: 0.55,
  },
  progressTrack: {
    borderRadius: 999,
    height: 7,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: 999,
    height: "100%",
  },
  rowTitle: {
    color: "#2d2926",
    fontSize: 14,
    fontWeight: "800",
  },
  mutedText: {
    color: "#706860",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  clothingSection: {
    marginTop: 18,
  },
  compactClothingSection: {
    marginTop: 10,
  },
  compactSectionLabel: {
    color: "#5c7a5f",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
    marginBottom: 8,
  },
  sectionTitle: {
    color: "#5c7a5f",
    fontSize: 14,
    fontWeight: "900",
  },
  clothingItem: {
    alignItems: "flex-start",
    backgroundColor: "#faf7f0",
    borderColor: "#e5ddd0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 11,
    marginTop: 8,
    padding: 13,
  },
  compactClothingItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 2,
  },
  primaryClothingItem: {
    backgroundColor: "#f4f7f4",
    borderColor: "#c6d9c7",
  },
  clothingText: {
    flex: 1,
  },
  priorityDot: {
    backgroundColor: "#5c7a5f",
    borderRadius: 5,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  secondaryDot: {
    backgroundColor: "#c97a45",
  },
  forecastRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
    paddingRight: 6,
  },
  forecastDay: {
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 112,
    overflow: "hidden",
    padding: 12,
    width: 112,
  },
  forecastTopRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  forecastDate: {
    color: "#5a5249",
    fontSize: 13,
    fontWeight: "800",
  },
  forecastTemp: {
    color: "#2d2926",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  forecastWeather: {
    color: "#706860",
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  forecastRainRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 8,
  },
  forecastRainText: {
    color: "#5a5249",
    fontSize: 11,
    fontWeight: "800",
  },
  forecastBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    minWidth: 62,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  forecastBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  settingsRow: {
    alignItems: "center",
    backgroundColor: "#fefcf8",
    borderColor: "rgba(217,208,195,0.9)",
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingsIcon: {
    alignItems: "center",
    backgroundColor: "#e4ece4",
    borderRadius: 15,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  settingsCopy: {
    flex: 1,
    minWidth: 0,
  },
  settingsTitle: {
    color: "#2d2926",
    fontSize: 15,
    fontWeight: "800",
  },
  settingsDetail: {
    color: "#706860",
    fontSize: 12,
    marginTop: 3,
  },
  settingsAction: {
    color: "#5c7a5f",
    fontSize: 13,
    fontWeight: "900",
  },
  sectionCopy: {
    color: "#706860",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 12,
  },
  tabBar: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderTopColor: "#e8e8e8",
    borderTopWidth: 1,
    flexDirection: "row",
    height: 78,
    justifyContent: "space-around",
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    gap: 4,
    justifyContent: "center",
    minHeight: 56,
  },
  tabLabel: {
    color: "#8a8a8a",
    fontSize: 11,
    fontWeight: "700",
  },
  tabLabelActive: {
    color: "#111111",
    fontWeight: "900",
  },
});
