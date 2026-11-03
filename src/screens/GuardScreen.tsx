import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "../components/Icons";
import { Button, Card, Overline, SectionTitle, StatusPill, Switch2, Toggle } from "../components/ui";
import { hasNativeFocus, InstalledApp, NativeFocus } from "../native/FocusNativeModule";
import type { FocusApp } from "../state/useFocusApp";

type Filter = "all" | "selected";

export function GuardScreen({ app }: { app: FocusApp }) {
  const { colors, permissions, blockedApps, websiteRules } = app;
  const [installed, setInstalled] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [domain, setDomain] = useState("");

  useEffect(() => {
    NativeFocus.getInstalledApps()
      .then(setInstalled)
      .catch(() => setInstalled([]));
  }, []);

  const enabledSet = useMemo(() => new Set(blockedApps.filter((a) => a.isEnabled).map((a) => a.packageName)), [blockedApps]);
  const enabledCount = enabledSet.size;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (installed ?? [])
      .filter((a) => !a.isProtected)
      .filter((a) => (filter === "selected" ? enabledSet.has(a.packageName) : true))
      .filter((a) => !q || a.appName.toLowerCase().includes(q) || a.packageName.toLowerCase().includes(q))
      .sort((a, b) => {
        const sa = enabledSet.has(a.packageName) ? 0 : 1;
        const sb = enabledSet.has(b.packageName) ? 0 : 1;
        return sa - sb || a.appName.localeCompare(b.appName);
      });
  }, [installed, query, filter, enabledSet]);

  const toggle = useCallback(
    (a: InstalledApp) => app.setAppBlocked(a.packageName, a.appName, !enabledSet.has(a.packageName)),
    [app, enabledSet]
  );

  const header = (
    <View style={{ gap: 12 }}>
      <View>
        <Overline colors={colors}>FOCUS GUARD</Overline>
        <Text style={[styles.heading, { color: colors.ink }]}>Protect your focus.</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 19 }}>
          During a focus block, selected apps are sent away and replaced by a calm FocusMate screen. Breaks never block.
        </Text>
      </View>

      {!hasNativeFocus && (
        <Card colors={colors}>
          <Text style={{ color: colors.peach, fontSize: 13, lineHeight: 19 }}>
            Android app blocking isn't available in this build (native module not found). Install the Android app build to use it.
          </Text>
        </Card>
      )}

      <Card colors={colors}>
        <SectionTitle colors={colors} overline="PERMISSIONS" title="What FocusMate needs" />
        <PermRow
          colors={colors}
          required
          title="Accessibility service"
          why="Lets FocusMate notice which app opened so it can block it. It does not read your screen content."
          granted={permissions.accessibility}
          onFix={NativeFocus.requestAccessibilityPermission}
        />
        <PermRow
          colors={colors}
          title="Notifications"
          why="Shows your running timer and tells you when a block ends."
          granted={permissions.notifications}
          onFix={() => NativeFocus.requestNotificationPermission()}
        />
        <PermRow
          colors={colors}
          title="Display over other apps"
          why="Helps the block screen appear reliably on top of a distracting app."
          granted={permissions.overlay}
          onFix={NativeFocus.requestOverlayPermission}
        />
        <PermRow
          colors={colors}
          title="Unrestricted battery"
          why="Keeps the timer accurate with the screen off on phones that aggressively stop background apps."
          granted={permissions.batteryOptimization}
          onFix={NativeFocus.requestBatteryOptimization}
          last
        />
        <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 10, lineHeight: 16 }}>
          If the Accessibility option is greyed out, open FocusMate's App info → ⋮ → "Allow restricted settings", then try again. Some phones (Samsung, Xiaomi, OnePlus) also need Autostart or "no restrictions" battery mode.
        </Text>
      </Card>

      <Card colors={colors}>
        <SectionTitle
          colors={colors}
          overline="BLOCKED APPS"
          title={`${enabledCount} selected`}
          right={<StatusPill colors={colors} tone={permissions.accessibility ? "good" : "warn"} label={permissions.accessibility ? "Guard on" : "Guard off"} />}
        />
        <View style={[styles.search, { backgroundColor: colors.surfaceSoft, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search apps"
            placeholderTextColor={colors.subtle}
            style={[styles.searchInput, { color: colors.ink }]}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Search installed apps"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search" hitSlop={10}>
              <Icon name="close" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <View style={styles.filterRow}>
          {(["all", "selected"] as Filter[]).map((f) => (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === f }}
              style={[styles.filterChip, { borderColor: filter === f ? colors.accent : colors.borderStrong, backgroundColor: filter === f ? colors.accentSoft : "transparent" }]}
            >
              <Text style={{ color: filter === f ? colors.accent : colors.ink2, fontWeight: "600", fontSize: 12 }}>{f === "all" ? "All apps" : "Selected"}</Text>
            </Pressable>
          ))}
        </View>
        {installed === null && <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />}
        {installed !== null && installed.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>
            {hasNativeFocus ? "No apps found." : "App list is only available on Android."}
          </Text>
        )}
        {installed !== null && installed.length > 0 && rows.length === 0 && (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>
            {filter === "selected" ? "You haven't selected any apps yet." : `No apps match “${query}”.`}
          </Text>
        )}
      </Card>
    </View>
  );

  const footer = (
    <Card colors={colors} style={{ marginTop: 12, marginBottom: 24 }}>
      <SectionTitle
        colors={colors}
        overline="WEBSITES"
        title="Website blocking"
        right={<StatusPill colors={colors} tone={app.websiteBlocking && app.vpnReady ? "good" : "neutral"} label={app.websiteBlocking && app.vpnReady ? "On · experimental" : "Experimental"} />}
      />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Blocks the sites below (and their subdomains) during focus blocks, using a private on-device DNS filter. No traffic leaves your phone. Phones show a key icon while it runs.
      </Text>
      <Toggle
        colors={colors}
        label="Block websites while focusing"
        value={app.websiteBlocking}
        onChange={app.setWebsiteBlocking}
        hint={app.websiteBlocking && !app.vpnReady ? "Waiting for VPN permission. Tap Allow in the Android prompt, or toggle again to retry." : undefined}
      />
      <Text style={{ color: colors.subtle, fontSize: 11, lineHeight: 16 }}>
        Won't work if your browser uses its own secure DNS (e.g. Chrome → Settings → Privacy → "Use secure DNS") or Android "Private DNS" is set to a hostname. Turn those off for blocking to apply. Only one VPN can run at a time.
      </Text>
      <View style={[styles.search, { backgroundColor: colors.surfaceSoft, borderColor: colors.border, marginTop: 12 }]}>
        <Icon name="link" size={16} color={colors.muted} />
        <TextInput
          value={domain}
          onChangeText={setDomain}
          placeholder="example.com"
          placeholderTextColor={colors.subtle}
          style={[styles.searchInput, { color: colors.ink }]}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={() => {
            app.addWebsite(domain);
            setDomain("");
          }}
          accessibilityLabel="Add website"
        />
        <Pressable
          accessibilityLabel="Add website"
          onPress={() => {
            app.addWebsite(domain);
            setDomain("");
          }}
          hitSlop={10}
        >
          <Icon name="plus" size={18} color={colors.accent} />
        </Pressable>
      </View>
      {websiteRules.map((w) => (
        <View key={w.id} style={[styles.siteRow, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.ink, fontSize: 14, flex: 1 }}>{w.domain}</Text>
          <Pressable onPress={() => app.deleteWebsite(w.id)} accessibilityLabel={`Remove ${w.domain}`} hitSlop={12}>
            <Icon name="close" size={16} color={colors.muted} />
          </Pressable>
        </View>
      ))}
    </Card>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.page }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(a) => a.packageName}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      initialNumToRender={14}
      windowSize={9}
      renderItem={({ item }) => {
        const on = enabledSet.has(item.packageName);
        return (
          <Pressable
            onPress={() => toggle(item)}
            accessibilityRole="switch"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`Block ${item.appName}`}
            style={[styles.appRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {item.iconBase64 ? (
              <Image source={{ uri: `data:image/png;base64,${item.iconBase64}` }} style={styles.icon} />
            ) : (
              <View style={[styles.icon, { backgroundColor: colors.surfaceSoft }]} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                {item.appName}
              </Text>
              <Text style={{ color: colors.subtle, fontSize: 11 }} numberOfLines={1}>
                {item.packageName}
              </Text>
            </View>
            <Switch2 colors={colors} value={on} />
          </Pressable>
        );
      }}
    />
  );
}

function PermRow({
  colors,
  title,
  why,
  granted,
  onFix,
  required,
  last,
}: {
  colors: FocusApp["colors"];
  title: string;
  why: string;
  granted: boolean;
  onFix: () => void;
  required?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.permRow, !last && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <View style={[styles.permIcon, { backgroundColor: granted ? colors.accentSoft : colors.surfaceSoft }]}>
        <Icon name={granted ? "check" : "lock"} size={16} color={granted ? colors.accent : colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>
          {title}
          {required ? <Text style={{ color: colors.peach, fontSize: 11 }}>  required</Text> : null}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 }}>{why}</Text>
      </View>
      {!granted && <Button colors={colors} variant={required ? "primary" : "secondary"} label="Enable" onPress={onFix} style={{ minHeight: 40, paddingHorizontal: 14 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 28, fontWeight: "600", letterSpacing: -0.7, marginTop: 4 },
  permRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  permIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, minHeight: 46 },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  filterRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  filterChip: { paddingHorizontal: 14, minHeight: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  appRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, marginTop: 8, minHeight: 60 },
  icon: { width: 38, height: 38, borderRadius: 10 },
  siteRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1 },
});
