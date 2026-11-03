import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Icon } from "../components/Icons";
import { Button, Card, Overline, ProgressRing, Segmented, StatusPill, Toggle } from "../components/ui";
import type { FocusMode } from "../engine/focusEngine";
import { formatClock } from "../lib/time";
import { isBreakType } from "../lib/stats";
import type { FocusApp } from "../state/useFocusApp";

const PRESETS = [15, 25, 30, 45, 60, 90];

const PHASE_LABEL: Record<string, string> = {
  focus: "Focus block",
  pomodoro_focus: "Pomodoro focus",
  short_break: "Short break",
  long_break: "Long break",
  stopwatch: "Open focus",
  custom: "Focus block",
};

export function FocusScreen({ app, onGoGuard }: { app: FocusApp; onGoGuard: () => void }) {
  const { colors, settings, pomodoro, active, activeElapsed, run, blockedApps, permissions } = app;
  const [mode, setMode] = useState<FocusMode>("focus");
  const [minutes, setMinutes] = useState(app.lastFocusMinutes);

  const enabledApps = blockedApps.filter((a) => a.isEnabled).length;

  const confirmEnd = () => {
    if (!active) return;
    const isBreak = isBreakType(active.sessionType);
    const isCountdown = !!active.plannedDurationSeconds && active.sessionType !== "stopwatch";
    const title = isBreak ? "Skip the rest of this break?" : isCountdown ? "End this session early?" : "Finish this session?";
    const body = isBreak
      ? "You'll go straight back to focus."
      : active.strictMode
      ? "You turned on Strict mode for this block. Are you sure you want to stop before time's up?"
      : isCountdown
      ? "The time you've focused so far will still be saved."
      : "Your time so far will be saved.";
    Alert.alert(title, body, [
      { text: "Keep going", style: "cancel" },
      {
        text: isBreak ? "Skip break" : isCountdown ? "End session" : "Finish",
        style: "destructive",
        onPress: () => (isBreak ? app.skipBreak() : app.endSession()),
      },
    ]);
  };

  // ---------------------------------------------------------------- active
  if (active) {
    const planned = active.plannedDurationSeconds;
    const isBreak = isBreakType(active.sessionType);
    const remaining = planned ? Math.max(0, planned - activeElapsed) : activeElapsed;
    const progress = planned ? activeElapsed / planned : (activeElapsed % 3600) / 3600;
    const paused = active.status === "paused";
    const isPomodoro = active.sessionType === "pomodoro_focus" || isBreak;
    const cycle = Math.max(1, pomodoro.sessionsBeforeLongBreak);
    const doneInCycle = run.completedFocus % cycle;
    const blocking = !isBreak && (!paused || active.strictMode);
    const accessibilityOff = !permissions.accessibility;
    const canPause = !(active.strictMode && !isBreak);

    return (
      <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={styles.content}>
        <View style={styles.centerCol}>
          <StatusPill
            colors={colors}
            tone={paused ? "warn" : isBreak ? "neutral" : "good"}
            label={paused ? "Paused" : isBreak ? "Recharging" : "In the zone"}
          />
          <Text style={[styles.phase, { color: colors.ink2 }]}>{PHASE_LABEL[active.sessionType] ?? "Focus"}</Text>

          <View style={{ marginVertical: 20 }} accessible accessibilityLabel={`${formatClock(remaining)} ${planned ? "remaining" : "elapsed"}`}>
            <ProgressRing
              size={260}
              stroke={12}
              progress={progress}
              trackColor={colors.surfaceSoft}
              color={isBreak ? colors.lavender : colors.accent}
            >
              <Text style={[styles.clock, { color: colors.ink }]}>{formatClock(remaining)}</Text>
              <Text style={[styles.clockSub, { color: colors.muted }]}>{planned ? "remaining" : "focused"}</Text>
            </ProgressRing>
          </View>

          {isPomodoro && (
            <View style={styles.dotsRow} accessible accessibilityLabel={`${doneInCycle} of ${cycle} focus blocks done in this cycle`}>
              {Array.from({ length: cycle }).map((_, i) => {
                const filled = i < doneInCycle;
                const current = !isBreak && i === doneInCycle;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      { borderColor: colors.accent, backgroundColor: filled ? colors.accent : current ? colors.accentSoft : "transparent" },
                    ]}
                  />
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.controls}>
          {canPause ? (
            <Button
              colors={colors}
              label={paused ? "Resume" : "Pause"}
              icon={paused ? "play" : "pause"}
              onPress={app.pauseResume}
              style={{ flex: 1 }}
            />
          ) : (
            <View style={[styles.lockedNote, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Icon name="lock" size={14} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, flex: 1 }}>Strict mode: pausing is disabled for this block.</Text>
            </View>
          )}
          <Button
            colors={colors}
            variant={isBreak ? "secondary" : "danger"}
            label={isBreak ? "Skip break" : active.sessionType === "stopwatch" ? "Finish" : "End"}
            icon={isBreak ? "arrow" : "stop"}
            onPress={confirmEnd}
            style={{ flex: canPause ? 0.7 : 0.5 }}
          />
        </View>

        <Card colors={colors} style={{ marginTop: 16 }}>
          <View style={styles.rowCenter}>
            <Icon name="shield" size={18} color={blocking && !accessibilityOff ? colors.accent : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>
                {isBreak
                  ? "Break time — apps are open"
                  : paused && !active.strictMode
                  ? "Blocking is paused with your timer"
                  : accessibilityOff
                  ? "App blocking isn't switched on"
                  : `Blocking ${enabledApps} app${enabledApps === 1 ? "" : "s"}`}
              </Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                {accessibilityOff && !isBreak ? "Turn on the Accessibility service in Guard so FocusMate can stop distracting apps." : isBreak ? "Blocking resumes with your next focus block." : "Distracting apps are sent away while you focus."}
              </Text>
            </View>
            {accessibilityOff && !isBreak && <Button colors={colors} variant="secondary" label="Fix" onPress={onGoGuard} style={{ minHeight: 40, paddingHorizontal: 14 }} />}
          </View>
        </Card>
      </ScrollView>
    );
  }

  // ------------------------------------------------------------------ idle
  const minutesLabel = mode === "pomodoro" ? pomodoro.focusDuration : minutes;
  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Overline colors={colors}>CHOOSE YOUR RHYTHM</Overline>
      <Text style={[styles.heading, { color: colors.ink }]}>Ready when you are.</Text>

      <View style={{ marginTop: 16 }}>
        <Segmented
          colors={colors}
          value={mode}
          onChange={setMode}
          options={[
            { value: "focus", label: "Focus", icon: "timer" },
            { value: "pomodoro", label: "Pomodoro", icon: "leaf" },
            { value: "stopwatch", label: "Stopwatch", icon: "clock" },
          ]}
        />
      </View>

      <Card colors={colors} style={{ marginTop: 16 }}>
        {mode === "focus" && (
          <>
            <Overline colors={colors}>DURATION</Overline>
            <View style={styles.presetWrap}>
              {PRESETS.map((m) => {
                const sel = m === minutes;
                return (
                  <Pressable
                    key={m}
                    accessibilityRole="button"
                    accessibilityState={{ selected: sel }}
                    onPress={() => setMinutes(m)}
                    style={[styles.preset, { borderColor: sel ? colors.accent : colors.borderStrong, backgroundColor: sel ? colors.accentSoft : "transparent" }]}
                  >
                    <Text style={{ color: sel ? colors.accent : colors.ink2, fontWeight: "700", fontSize: 14 }}>{m}m</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.customRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease duration by 5 minutes"
                onPress={() => setMinutes((m) => Math.max(5, m - 5))}
                style={[styles.stepBtn, { borderColor: colors.borderStrong }]}
              >
                <Text style={[styles.stepGlyph, { color: colors.ink }]}>–</Text>
              </Pressable>
              <View style={{ alignItems: "center", minWidth: 120 }}>
                <Text style={[styles.bigMinutes, { color: colors.ink }]}>{minutes}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>minutes</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase duration by 5 minutes"
                onPress={() => setMinutes((m) => Math.min(240, m + 5))}
                style={[styles.stepBtn, { borderColor: colors.borderStrong }]}
              >
                <Text style={[styles.stepGlyph, { color: colors.ink }]}>+</Text>
              </Pressable>
            </View>
          </>
        )}

        {mode === "pomodoro" && (
          <>
            <Overline colors={colors}>YOUR CYCLE</Overline>
            <View style={styles.cycleRow}>
              <CycleStat colors={colors} value={`${pomodoro.focusDuration}m`} label="Focus" accent />
              <CycleStat colors={colors} value={`${pomodoro.shortBreakDuration}m`} label="Short break" />
              <CycleStat colors={colors} value={`${pomodoro.longBreakDuration}m`} label="Long break" />
            </View>
            <Text style={[styles.rowSub, { color: colors.muted, marginTop: 12 }]}>
              Focus and break blocks follow each other automatically. Every {pomodoro.sessionsBeforeLongBreak} focus blocks earns a long break. Adjust these in Settings.
            </Text>
          </>
        )}

        {mode === "stopwatch" && (
          <>
            <Overline colors={colors}>OPEN-ENDED</Overline>
            <Text style={[styles.rowSub, { color: colors.muted, marginTop: 8, fontSize: 13 }]}>
              No countdown. Count up from zero and finish whenever you're done. Great for deep work you don't want to cut short.
            </Text>
          </>
        )}
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <Toggle
          colors={colors}
          label="Strict mode"
          hint="No pausing, and ending early asks you to confirm. A commitment tool — it can't stop you uninstalling the app."
          value={settings.strictModeEnabled}
          onChange={(v) => app.updateSettings({ strictModeEnabled: v })}
        />
      </Card>

      <Pressable onPress={onGoGuard} accessibilityRole="button" style={[styles.guardLine, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Icon name="shield" size={16} color={permissions.accessibility ? colors.accent : colors.peach} />
        <Text style={{ color: colors.ink2, fontSize: 13, flex: 1 }}>
          {!permissions.accessibility
            ? "App blocking is off — set it up in Guard"
            : enabledApps === 0
            ? "No apps selected to block yet"
            : `${enabledApps} app${enabledApps === 1 ? "" : "s"} will be blocked during focus`}
        </Text>
        <Icon name="chevron" size={14} color={colors.muted} />
      </Pressable>

      <Button
        colors={colors}
        label={mode === "stopwatch" ? "Start stopwatch" : `Start ${minutesLabel} min ${mode === "pomodoro" ? "Pomodoro" : "focus"}`}
        icon="play"
        onPress={() => app.startSession(mode, minutes)}
        style={{ marginTop: 16, minHeight: 56 }}
      />
    </ScrollView>
  );
}

function CycleStat({ colors, value, label, accent }: { colors: FocusApp["colors"]; value: string; label: string; accent?: boolean }) {
  return (
    <View style={[styles.cycleStat, { backgroundColor: colors.surfaceSoft }]}>
      <Text style={{ color: accent ? colors.accent : colors.ink, fontSize: 22, fontWeight: "700" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 28, fontWeight: "600", letterSpacing: -0.7, marginTop: 4 },
  centerCol: { alignItems: "center", paddingTop: 8 },
  phase: { fontSize: 15, fontWeight: "600", marginTop: 10 },
  clock: { fontSize: 54, fontWeight: "300", letterSpacing: -1, fontVariant: ["tabular-nums"] },
  clockSub: { fontSize: 13, marginTop: 2 },
  dotsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  controls: { flexDirection: "row", gap: 12, marginTop: 24 },
  lockedNote: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, minHeight: 48 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowSub: { fontSize: 12, lineHeight: 18, marginTop: 2 },
  presetWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  preset: { minWidth: 62, minHeight: 44, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  customRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 18 },
  stepBtn: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepGlyph: { fontSize: 24, marginTop: -2 },
  bigMinutes: { fontSize: 44, fontWeight: "300", letterSpacing: -1 },
  cycleRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  cycleStat: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  guardLine: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, padding: 14, marginTop: 12, minHeight: 48 },
});
