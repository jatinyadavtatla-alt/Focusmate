import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeColors } from "../theme/colors";
import { Icon } from "./Icons";

interface HeaderProps {
  colors: ThemeColors;
  currentTitle: string;
  onRefresh: () => void;
  onOpenSettings: () => void;
  userName?: string;
}

export function Header({ colors, currentTitle, onRefresh, onOpenSettings, userName }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const initial = userName && userName.trim() ? userName.trim().charAt(0).toUpperCase() : null;
  return (
    <View style={[styles.container, { backgroundColor: colors.page, borderBottomColor: colors.border, height: 56 + insets.top, paddingTop: insets.top }]}>
      <View style={styles.brandRow}>
        <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
          <Icon name="leaf" size={16} color="#1c2a16" />
        </View>
        <Text style={[styles.brandName, { color: colors.ink }]}>focusmate</Text>
      </View>

      <View style={styles.breadcrumb}>
        <Text style={[styles.crumbMuted, { color: colors.muted }]}>Personal</Text>
        <Icon name="chevron" size={11} color={colors.subtle} />
        <Text style={[styles.crumbActive, { color: colors.ink2 }]} numberOfLines={1}>
          {currentTitle}
        </Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          style={[styles.iconButton, { borderColor: colors.border }]}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <Icon name="refresh" size={15} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={[styles.avatar, { borderColor: colors.border }]}
          onPress={onOpenSettings}
          activeOpacity={0.7}
        >
          {initial ? <Text style={styles.avatarText}>{initial}</Text> : <Icon name="settings" size={15} color={colors.muted} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderBottomLeftRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 140,
  },
  crumbMuted: {
    fontSize: 11,
  },
  crumbActive: {
    fontSize: 11,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#d1a37c",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2b1c14",
  },
});

