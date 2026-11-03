import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Overline, SectionTitle, Segmented, Stepper, Toggle } from "../components/ui";
import { formatGoal } from "../lib/time";
import type { FocusApp } from "../state/useFocusApp";

export function SettingsScreen({ app }: { app: FocusApp }) {
  const { colors, settings, pomodoro, active } = app;
  const [name, setName] = useState(app.userName);
  const locked = !!active;

  const confirmClear = () =>
    Alert.alert("Delete all session history?", "This removes your analytics and streaks permanently. Your settings and blocked apps are kept.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete history", style: "destructive", onPress: () => app.clearHistory() },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Overline colors={colors}>PREFERENCES</Overline>
      <Text style={[styles.heading, { color: colors.ink }]}>Settings</Text>

      <Card colors={colors} style={{ marginTop: 16 }}>
        <SectionTitle colors={colors} overline="APPEARANCE" title="Theme" />
        <Segmented
          colors={colors}
          value={settings.theme}
          onChange={(v) => app.updateSettings({ theme: v })}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "System" },
          ]}
        />
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="GOALS" title="Daily focus goal" />
        <Stepper
          colors={colors}
          label={formatGoal(settings.dailyGoalMinutes)}
          value={settings.dailyGoalMinutes}
          unit="min"
          min={15}
          max={720}
          step={15}
          onChange={(v) => app.updateSettings({ dailyGoalMinutes: v })}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>Drives your progress ring and the “goal met” days in Insights.</Text>
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="POMODORO" title="Cycle lengths" />
        <Stepper colors={colors} label="Focus" value={pomodoro.focusDuration} unit="min" min={5} max={90} step={5} onChange={(v) => app.updatePomodoro({ focusDuration: v })} />
        <Stepper colors={colors} label="Short break" value={pomodoro.shortBreakDuration} unit="min" min={1} max={30} onChange={(v) => app.updatePomodoro({ shortBreakDuration: v })} />
        <Stepper colors={colors} label="Long break" value={pomodoro.longBreakDuration} unit="min" min={5} max={60} step={5} onChange={(v) => app.updatePomodoro({ longBreakDuration: v })} />
        <Stepper colors={colors} label="Blocks before long break" value={pomodoro.sessionsBeforeLongBreak} unit="" min={2} max={8} onChange={(v) => app.updatePomodoro({ sessionsBeforeLongBreak: v })} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {locked ? "Changes apply to the next phase that starts." : "Used the next time you start a Pomodoro."}
        </Text>
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="ALERTS" title="When a block ends" />
        <Toggle colors={colors} label="Vibration" value={settings.vibrationEnabled} onChange={(v) => app.updateSettings({ vibrationEnabled: v })} />
        <Toggle colors={colors} label="Sound" value={settings.soundEnabled} onChange={(v) => app.updateSettings({ soundEnabled: v })} />
        <Toggle
          colors={colors}
          label="Strict mode by default"
          hint="No pausing, and ending early needs confirmation."
          value={settings.strictModeEnabled}
          onChange={(v) => app.updateSettings({ strictModeEnabled: v })}
        />
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="PROFILE" title="Your name" />
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => app.setUserName(name)}
          placeholder="Shown in your greeting (optional)"
          placeholderTextColor={colors.subtle}
          maxLength={40}
          accessibilityLabel="Your name"
          style={[styles.input, { color: colors.ink, backgroundColor: colors.surfaceSoft, borderColor: colors.border }]}
        />
      </Card>

      <Card colors={colors} style={{ marginTop: 12, marginBottom: 24 }}>
        <SectionTitle colors={colors} overline="DATA" title="Stored on this phone" />
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
          FocusMate works fully offline. Sessions and settings live in a local database and never leave your device.
        </Text>
        <Button colors={colors} variant="danger" label="Delete session history" onPress={confirmClear} disabled={locked} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 28, fontWeight: "600", letterSpacing: -0.7, marginTop: 4 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
});
