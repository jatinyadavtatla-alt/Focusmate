import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomNav, TabKey } from "./src/components/BottomNav";
import { Header } from "./src/components/Header";
import { AnalyticsScreen } from "./src/screens/AnalyticsScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { FocusScreen } from "./src/screens/FocusScreen";
import { GuardScreen } from "./src/screens/GuardScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { useFocusApp } from "./src/state/useFocusApp";

const TITLES: Record<TabKey, string> = {
  home: "Overview",
  focus: "Focus",
  analytics: "Insights",
  blocklist: "Guard",
  settings: "Settings",
};

function Root() {
  const app = useFocusApp();
  const { colors } = app;
  const [tab, setTab] = useState<TabKey>("home");

  // Android back: return to Overview first, then let the OS leave the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab !== "home") {
        setTab("home");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [tab]);

  // Transient messages (save errors) disappear on their own.
  useEffect(() => {
    if (!app.message) return;
    const id = setTimeout(app.clearMessage, 4000);
    return () => clearTimeout(id);
  }, [app.message, app.clearMessage]);

  // The Guard screen's permission status must be fresh whenever it is opened.
  useEffect(() => {
    if (tab === "blocklist" || tab === "focus") app.refreshPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!app.ready) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.page }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const stats = app.dashboardStats;

  return (
    <View style={[styles.root, { backgroundColor: colors.page }]}>
      <StatusBar style={app.isDark ? "light" : "dark"} />
      <Header
        colors={colors}
        currentTitle={TITLES[tab]}
        userName={app.userName}
        onRefresh={() => {
          app.refresh();
          app.refreshPermissions();
        }}
        onOpenSettings={() => setTab("settings")}
      />
      <View style={styles.body}>
        {tab === "home" && (
          <DashboardScreen
            colors={colors}
            settings={app.settings}
            sessions={app.sessions}
            activeSession={app.active}
            activeElapsed={app.activeElapsed}
            todaySeconds={stats.todaySeconds}
            goalRatio={stats.goalRatio}
            weekDays={stats.weekDays}
            maxWeekSeconds={stats.maxWeekSeconds}
            streak={stats.streak}
            weekSeconds={stats.weekSeconds}
            userName={app.userName}
            onStartDefaultFocus={() => {
              app.startSession("focus", app.lastFocusMinutes);
              setTab("focus");
            }}
            onGoFocus={() => setTab("focus")}
            onGoAnalytics={() => setTab("analytics")}
            onGoGuard={() => setTab("blocklist")}
            onGoSettings={() => setTab("settings")}
            onPauseResume={app.pauseResume}
          />
        )}
        {tab === "focus" && <FocusScreen app={app} onGoGuard={() => setTab("blocklist")} />}
        {tab === "analytics" && <AnalyticsScreen app={app} />}
        {tab === "blocklist" && <GuardScreen app={app} />}
        {tab === "settings" && <SettingsScreen app={app} />}
      </View>
      {app.message && (
        <View style={[styles.toast, { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong }]} accessibilityLiveRegion="polite">
          <Text style={{ color: colors.ink, fontSize: 13 }}>{app.message}</Text>
        </View>
      )}
      <BottomNav currentTab={tab} onSelectTab={setTab} colors={colors} hasActiveSession={!!app.active} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  splash: { flex: 1, alignItems: "center", justifyContent: "center" },
  toast: { position: "absolute", left: 16, right: 16, bottom: 96, borderRadius: 12, borderWidth: 1, padding: 14 },
});
