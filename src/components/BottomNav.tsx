import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeColors } from "../theme/colors";
import { Icon, IconName } from "./Icons";

export type TabKey = "home" | "focus" | "analytics" | "blocklist" | "settings";

interface BottomNavProps {
  currentTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
  colors: ThemeColors;
  hasActiveSession: boolean;
}

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Overview", icon: "home" },
  { key: "focus", label: "Focus", icon: "timer" },
  { key: "analytics", label: "Insights", icon: "chart" },
  { key: "blocklist", label: "Guard", icon: "shield" },
  { key: "settings", label: "Settings", icon: "settings" },
];

export function BottomNav({ currentTab, onSelectTab, colors, hasActiveSession }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64 + insets.bottom, paddingBottom: 6 + insets.bottom }]}>
      {TABS.map((tab) => {
        const isActive = currentTab === tab.key;
        const iconColor = isActive ? colors.accent : colors.muted;
        const textColor = isActive ? colors.accent : colors.muted;

        return (
          <TouchableOpacity
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            style={styles.tabButton}
            onPress={() => onSelectTab(tab.key)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Icon name={tab.icon} size={20} color={iconColor} />
              {tab.key === "focus" && hasActiveSession && (
                <View style={[styles.liveDot, { backgroundColor: colors.accent }]} />
              )}
            </View>
            <Text style={[styles.tabLabel, { color: textColor, fontWeight: isActive ? "600" : "400" }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  iconContainer: {
    position: "relative",
  },
  liveDot: {
    position: "absolute",
    right: -4,
    top: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tabLabel: {
    fontSize: 10,
    letterSpacing: -0.2,
  },
});

