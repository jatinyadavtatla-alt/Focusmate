import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Card, Overline, Segmented, SectionTitle } from "../components/ui";
import { buildAnalytics, isFocusType, liveElapsed } from "../lib/stats";
import { formatMinutes, WEEKDAYS } from "../lib/time";
import type { FocusApp } from "../state/useFocusApp";

type Range = "7" | "30" | "90";

export function AnalyticsScreen({ app }: { app: FocusApp }) {
  const { colors, sessions, settings, nowTick } = app;
  const [range, setRange] = useState<Range>("7");
  const days = Number(range);
  const a = useMemo(() => buildAnalytics(sessions, settings, days, nowTick), [sessions, settings, days, nowTick]);

  const delta =
    a.previousTotalSeconds > 0 ? Math.round(((a.totalSeconds - a.previousTotalSeconds) / a.previousTotalSeconds) * 100) : null;
  const maxDay = Math.max(1, ...a.daily.map((d) => d.seconds));
  const maxHour = Math.max(1, ...a.byHour);
  const kindTotal = Math.max(1, a.byKind.focus + a.byKind.pomodoro + a.byKind.stopwatch);
  const goalSec = settings.dailyGoalMinutes * 60;
  const recent = useMemo(
    () => sessions.filter((s) => isFocusType(s.sessionType) && s.status !== "active" && s.status !== "paused" && liveElapsed(s, nowTick) > 0).slice(0, 8),
    [sessions, nowTick]
  );
  const empty = a.sessionCount === 0;

  return (
    <ScrollView style={{ backgroundColor: colors.page }} contentContainerStyle={styles.content}>
      <Overline colors={colors}>YOUR PROGRESS</Overline>
      <Text style={[styles.heading, { color: colors.ink }]}>Analytics</Text>
      <View style={{ marginTop: 14 }}>
        <Segmented
          colors={colors}
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </View>

      <Card colors={colors} style={{ marginTop: 16 }}>
        <Overline colors={colors}>TOTAL FOCUS TIME</Overline>
        <Text style={[styles.big, { color: colors.ink }]}>{formatMinutes(a.totalSeconds)}</Text>
        <Text style={{ color: delta === null ? colors.muted : delta >= 0 ? colors.accent : colors.peach, fontSize: 13, marginTop: 2 }}>
          {delta === null ? "No earlier period to compare yet" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs previous ${days} days`}
        </Text>
      </Card>

      <View style={styles.grid}>
        <Tile colors={colors} label="Sessions" value={String(a.sessionCount)} />
        <Tile colors={colors} label="Avg session" value={formatMinutes(a.avgSessionSeconds)} />
        <Tile colors={colors} label="Longest" value={formatMinutes(a.longestSessionSeconds)} />
        <Tile colors={colors} label="Goal met" value={`${a.daysGoalMet}/${days}d`} />
        <Tile colors={colors} label="Streak" value={`${a.streak}d`} />
        <Tile colors={colors} label="Best streak" value={`${a.longestStreak}d`} />
      </View>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="DAILY" title="Focus per day" />
        {empty ? (
          <Empty colors={colors} />
        ) : days <= 7 ? (
          <View style={styles.bars}>
            {a.daily.map((d) => (
              <View key={d.key} style={styles.barCol}>
                <Text style={{ color: colors.muted, fontSize: 10 }}>{d.seconds ? formatMinutes(d.seconds) : ""}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceSoft }]}>
                  <View style={{ height: `${(d.seconds / maxDay) * 100}%`, backgroundColor: d.seconds >= goalSec ? colors.accent : colors.accentStrong, borderRadius: 6 }} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{WEEKDAYS[d.date.getDay()].slice(0, 1)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.dense}>
            {a.daily.map((d) => (
              <View key={d.key} style={styles.denseCol}>
                <View style={[styles.denseTrack, { backgroundColor: colors.surfaceSoft }]}>
                  <View style={{ height: `${(d.seconds / maxDay) * 100}%`, backgroundColor: d.seconds >= goalSec ? colors.accent : colors.accentStrong }} />
                </View>
              </View>
            ))}
          </View>
        )}
        {!empty && <Text style={{ color: colors.subtle, fontSize: 11, marginTop: 8 }}>Brighter bars reached your {formatMinutes(goalSec)} goal.</Text>}
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="WHEN" title="Your focus hours" />
        {empty ? (
          <Empty colors={colors} />
        ) : (
          <>
            <View style={styles.hours}>
              {a.byHour.map((s, h) => (
                <View key={h} style={styles.hourCol}>
                  <View style={[styles.hourTrack, { backgroundColor: colors.surfaceSoft }]}>
                    <View style={{ height: `${(s / maxHour) * 100}%`, backgroundColor: colors.lavender }} />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.hourLabels}>
              {["12a", "6a", "12p", "6p", "11p"].map((l) => (
                <Text key={l} style={{ color: colors.subtle, fontSize: 10 }}>{l}</Text>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="HOW YOU FOCUS" title="Session types" />
        {empty ? (
          <Empty colors={colors} />
        ) : (
          <>
            <View style={[styles.stack, { backgroundColor: colors.surfaceSoft }]}>
              <View style={{ flex: a.byKind.focus / kindTotal, backgroundColor: colors.accent }} />
              <View style={{ flex: a.byKind.pomodoro / kindTotal, backgroundColor: colors.lavender }} />
              <View style={{ flex: a.byKind.stopwatch / kindTotal, backgroundColor: colors.peach }} />
            </View>
            <Legend colors={colors} color={colors.accent} label="Timed focus" value={formatMinutes(a.byKind.focus)} />
            <Legend colors={colors} color={colors.lavender} label="Pomodoro" value={formatMinutes(a.byKind.pomodoro)} />
            <Legend colors={colors} color={colors.peach} label="Stopwatch" value={formatMinutes(a.byKind.stopwatch)} />
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 10 }}>
              {a.completedCount} completed · {a.endedEarlyCount} ended early
            </Text>
          </>
        )}
      </Card>

      <Card colors={colors} style={{ marginTop: 12 }}>
        <SectionTitle colors={colors} overline="HISTORY" title="Recent sessions" />
        {recent.length === 0 ? (
          <Empty colors={colors} />
        ) : (
          recent.map((s, i) => (
            <View key={s.id} style={[styles.histRow, i > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>
                  {s.sessionType === "pomodoro_focus" ? "Pomodoro" : s.sessionType === "stopwatch" ? "Stopwatch" : "Focus"} · {formatMinutes(liveElapsed(s, nowTick))}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })},{" "}
                  {new Date(s.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={{ color: s.status === "completed" ? colors.accent : colors.peach, fontSize: 12, fontWeight: "600" }}>
                {s.status === "completed" ? "Completed" : "Ended early"}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

function Tile({ colors, label, value }: { colors: FocusApp["colors"]; label: string; value: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: "700", letterSpacing: 0.8 }}>{label.toUpperCase()}</Text>
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "600", marginTop: 4 }}>{value}</Text>
    </View>
  );
}

function Legend({ colors, color, label, value }: { colors: FocusApp["colors"]; color: string; label: string; value: string }) {
  return (
    <View style={styles.legend}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: colors.ink2, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function Empty({ colors }: { colors: FocusApp["colors"] }) {
  return <Text style={{ color: colors.muted, fontSize: 13 }}>Nothing here yet. Finish a focus session and it will show up.</Text>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  heading: { fontSize: 28, fontWeight: "600", letterSpacing: -0.7, marginTop: 4 },
  big: { fontSize: 40, fontWeight: "300", letterSpacing: -1, marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  tile: { width: "31.5%", flexGrow: 1, borderRadius: 14, borderWidth: 1, padding: 12 },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 8, height: 150 },
  barCol: { flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  barTrack: { width: "100%", flex: 1, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  dense: { flexDirection: "row", alignItems: "flex-end", gap: 1, height: 110 },
  denseCol: { flex: 1, height: "100%" },
  denseTrack: { flex: 1, justifyContent: "flex-end", borderRadius: 2, overflow: "hidden" },
  hours: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 70 },
  hourCol: { flex: 1, height: "100%" },
  hourTrack: { flex: 1, justifyContent: "flex-end", borderRadius: 3, overflow: "hidden" },
  hourLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  stack: { flexDirection: "row", height: 14, borderRadius: 7, overflow: "hidden", marginBottom: 12 },
  legend: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  histRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
});
