import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../components/Icons";
import { Session, Settings } from "../db/sqlite";
import { ProgressRing } from "../components/ui";
import { formatGoal } from "../lib/time";
import { ThemeColors } from "../theme/colors";

export interface DashboardProps {
  colors: ThemeColors;
  settings: Settings;
  sessions: Session[];
  activeSession: Session | null;
  activeElapsed: number;
  todaySeconds: number;
  goalRatio: number;
  weekDays: { date: Date; key: string; seconds: number; label: string }[];
  maxWeekSeconds: number;
  streak: number;
  weekSeconds: number;
  onStartDefaultFocus: () => void;
  onGoFocus: () => void;
  onGoAnalytics: () => void;
  onGoGuard: () => void;
  onGoSettings: () => void;
  onPauseResume: () => void;
  userName?: string;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatMinutes(seconds: number): string {
  const m = Math.floor(Math.max(0, seconds) / 60);
  if (m < 60) return `${m}m`;
  const hrs = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DashboardScreen({
  colors,
  settings,
  sessions,
  activeSession,
  activeElapsed,
  todaySeconds,
  goalRatio,
  weekDays,
  maxWeekSeconds,
  streak,
  weekSeconds,
  onStartDefaultFocus,
  onGoFocus,
  onGoAnalytics,
  onGoGuard,
  onGoSettings,
  onPauseResume,
  userName,
}: DashboardProps) {
  const todayCount = sessions.filter(
    (s) => s.status === "completed" && new Date(s.startedAt).toDateString() === new Date().toDateString()
  ).length;

  const todayRemaining = activeSession?.plannedDurationSeconds
    ? Math.max(0, activeSession.plannedDurationSeconds - activeElapsed)
    : activeElapsed;

  const dayText = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  const recentSessions = sessions
    .filter((s) => s.status === "completed" || s.status === "cancelled")
    .slice(0, 4);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.page }]} contentContainerStyle={styles.content}>
      {/* Page Heading */}
      <View style={styles.heading}>
        <View style={styles.headingLeft}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.eyebrowText, { color: colors.muted }]}>YOUR DAY, AT YOUR PACE</Text>
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>
            {greeting()}{userName ? `, ${userName}` : ""} <Text style={{ color: colors.accent }}>✳</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            A little focus goes a long way. Here’s your space for today.
          </Text>
        </View>

        <View style={[styles.dateChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="calendar" size={13} color={colors.muted} />
          <Text style={[styles.dateChipText, { color: colors.ink2 }]}>{dayText}</Text>
        </View>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIconBadge, { backgroundColor: "rgba(192, 237, 138, 0.12)" }]}>
            <Icon name="clock" size={16} color={colors.accent} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subtle }]}>FOCUSED TODAY</Text>
          <Text style={[styles.statValue, { color: colors.ink }]}>{formatMinutes(todaySeconds)}</Text>
          <Text style={[styles.statNote, { color: colors.muted }]}>
            of {formatGoal(settings.dailyGoalMinutes)}
          </Text>
          <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceSoft }]}>
            <View style={[styles.progressBarFill, { width: `${Math.min(100, goalRatio)}%`, backgroundColor: colors.accent }]} />
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIconBadge, { backgroundColor: "rgba(193, 169, 241, 0.12)" }]}>
            <Icon name="target" size={16} color={colors.lavender} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subtle }]}>SESSIONS</Text>
          <Text style={[styles.statValue, { color: colors.ink }]}>
            {todayCount} <Text style={[styles.statSmall, { color: colors.muted }]}>today</Text>
          </Text>
          <Text style={[styles.statNote, { color: colors.muted }]}>
            {activeSession ? "One in progress" : "Every block counts"}
          </Text>
          <Text style={styles.watermark}>{String(todayCount).padStart(2, "0")}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.statIconBadge, { backgroundColor: "rgba(239, 180, 147, 0.12)" }]}>
            <Icon name="flame" size={16} color={colors.peach} />
          </View>
          <Text style={[styles.statLabel, { color: colors.subtle }]}>STREAK</Text>
          <Text style={[styles.statValue, { color: colors.ink }]}>
            {streak} <Text style={[styles.statSmall, { color: colors.muted }]}>{streak === 1 ? "day" : "days"}</Text>
          </Text>
          <Text style={[styles.statNote, { color: colors.muted }]}>
            {streak > 0 ? "Keep momentum" : "Fresh start today"}
          </Text>
          <Text style={styles.streakSpark}>✦</Text>
        </View>
      </View>

      {/* Focus Hero Card */}
      <View style={[styles.heroCard, { borderColor: colors.borderStrong }]}>
        <View style={styles.heroKickerRow}>
          <View style={[styles.heroDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.heroKicker}>YOUR FOCUS SPACE</Text>
        </View>

        {activeSession ? (
          <View style={styles.heroActiveWrap}>
            <Text style={styles.heroActiveTitle}>
              {activeSession.status === "paused" ? "On a gentle pause." : "You’re in the zone."}
            </Text>
            <Text style={styles.heroActiveSub}>
              {activeSession.sessionType === "pomodoro_focus" ? "Pomodoro Focus" : "Focus Session"} ·{" "}
              {activeSession.strictMode ? "Strict mode on" : "No pressure, just flow"}
            </Text>
            <Text style={styles.heroActiveTimer}>{formatClock(todayRemaining)}</Text>
            <View style={styles.heroBtnRow}>
              <TouchableOpacity
                style={[styles.heroPrimaryBtn, { backgroundColor: colors.accent }]}
                onPress={activeSession.status === "paused" ? onPauseResume : onGoFocus}
                activeOpacity={0.8}
              >
                <Text style={styles.heroPrimaryBtnText}>
                  {activeSession.status === "paused" ? "Resume session" : "Open timer"}
                </Text>
                <Icon name="arrow" size={14} color="#172016" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.heroIdleWrap}>
            <Text style={styles.heroIdleTitle}>Make space for{"\n"}what matters.</Text>
            <Text style={styles.heroIdleSub}>One intentional block can change the shape of your day.</Text>
            <TouchableOpacity
              style={[styles.heroPrimaryBtn, { backgroundColor: colors.accent }]}
              onPress={onStartDefaultFocus}
              activeOpacity={0.8}
            >
              <Icon name="play" size={14} color="#172016" />
              <Text style={styles.heroPrimaryBtnText}>Start a 30 min focus</Text>
              <Icon name="arrow" size={14} color="#172016" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroLink} onPress={onGoFocus} activeOpacity={0.7}>
              <Text style={styles.heroLinkText}>Choose a different timer</Text>
              <Icon name="arrow" size={12} color="#b9c7b8" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Intention & Week Split Cards */}
      <View style={styles.splitGrid}>
        {/* Daily Intention Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.sectionOverline, { color: colors.subtle }]}>A GENTLE TARGET</Text>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>Daily intention</Text>
            </View>
            <TouchableOpacity onPress={onGoSettings} activeOpacity={0.7}>
              <Icon name="more" size={16} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <View style={styles.ringContainer}>
            <ProgressRing size={116} stroke={8} progress={goalRatio / 100} trackColor={colors.surfaceSoft} color={colors.accent}>
              <Text style={[styles.ringPercent, { color: colors.ink }]}>{Math.round(goalRatio)}%</Text>
              <Text style={[styles.ringSub, { color: colors.muted }]}>of your goal</Text>
            </ProgressRing>
          </View>

          <View style={styles.goalNums}>
            <View style={styles.goalNumItem}>
              <Text style={[styles.goalNumLabel, { color: colors.subtle }]}>FOCUSED</Text>
              <Text style={[styles.goalNumVal, { color: colors.ink }]}>{formatMinutes(todaySeconds)}</Text>
            </View>
            <View style={[styles.goalDivider, { backgroundColor: colors.border }]} />
            <View style={styles.goalNumItem}>
              <Text style={[styles.goalNumLabel, { color: colors.subtle }]}>GOAL</Text>
              <Text style={[styles.goalNumVal, { color: colors.ink }]}>
                {settings.dailyGoalMinutes >= 60 ? `${settings.dailyGoalMinutes / 60}h` : `${settings.dailyGoalMinutes}m`}
              </Text>
            </View>
          </View>
        </View>

        {/* Week in Focus Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.sectionOverline, { color: colors.subtle }]}>SHOWING UP ADDS UP</Text>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>Your week, in focus</Text>
            </View>
            <TouchableOpacity onPress={onGoAnalytics} style={styles.textBtn}>
              <Text style={[styles.textBtnLabel, { color: colors.accent }]}>Insights</Text>
              <Icon name="arrow" size={12} color={colors.accent} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekSummaryRow}>
            <Text style={[styles.weekTotal, { color: colors.ink }]}>{formatMinutes(weekSeconds)}</Text>
            <Text style={[styles.weekSub, { color: colors.muted }]}>total this week</Text>
          </View>

          {/* Bar Chart */}
          <View style={styles.barsContainer}>
            {weekDays.map((d, idx) => {
              const heightPct = d.seconds ? Math.max(10, (d.seconds / maxWeekSeconds) * 100) : 6;
              const isToday = idx === 6;
              return (
                <View key={d.key} style={styles.barCol}>
                  <View style={[styles.barTrack, { backgroundColor: colors.surfaceSoft }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${heightPct}%`,
                          backgroundColor: isToday ? colors.accent : "rgba(192, 237, 138, 0.45)",
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: isToday ? colors.accent : colors.muted }]}>
                    {d.label.slice(0, 1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* Focus Guard Feature Card */}
      <TouchableOpacity
        style={[styles.card, styles.guardCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onGoGuard}
        activeOpacity={0.8}
      >
        <View style={styles.guardRow}>
          <View style={[styles.guardIconWrap, { backgroundColor: "rgba(192, 237, 138, 0.12)" }]}>
            <Icon name="shield" size={20} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionOverline, { color: colors.accent }]}>ACTIVE PROTECTION</Text>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Focus Guard App Blocker</Text>
            <Text style={[styles.guardDesc, { color: colors.muted }]}>
              Native accessibility service actively intercepts distraction apps during your focus sessions.
            </Text>
          </View>
          <Icon name="arrow" size={16} color={colors.muted} />
        </View>
      </TouchableOpacity>

      {/* Recent Sessions List */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 24 }]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.sectionOverline, { color: colors.subtle }]}>A LOOK BACK</Text>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>Recent sessions</Text>
          </View>
          <TouchableOpacity onPress={onGoAnalytics} style={styles.textBtn}>
            <Text style={[styles.textBtnLabel, { color: colors.accent }]}>See all</Text>
            <Icon name="arrow" size={12} color={colors.accent} />
          </TouchableOpacity>
        </View>

        {recentSessions.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Icon name="leaf" size={24} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>Your first session starts here</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>Once you complete a block, it will show up here.</Text>
          </View>
        ) : (
          <View style={styles.sessionList}>
            {recentSessions.map((session) => {
              const isComplete = session.status === "completed";
              const dateStr = new Date(session.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
              return (
                <View key={session.id} style={[styles.sessionRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.sessionIcon, { backgroundColor: isComplete ? "rgba(192, 237, 138, 0.15)" : colors.surfaceSoft }]}>
                    <Icon name={session.sessionType.includes("break") ? "leaf" : "timer"} size={14} color={isComplete ? colors.accent : colors.muted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sessionName, { color: colors.ink }]}>
                      {session.sessionType === "pomodoro_focus" ? "Pomodoro focus" : session.sessionType.includes("break") ? "Break" : "Focus session"}
                    </Text>
                    <Text style={[styles.sessionMeta, { color: colors.muted }]}>
                      {dateStr} {session.strictMode ? "· Strict" : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.sessionDuration, { color: colors.ink }]}>{formatMinutes(session.elapsedSeconds)}</Text>
                    <Text style={[styles.sessionState, { color: isComplete ? colors.accent : colors.peach }]}>
                      {isComplete ? "Complete" : "Ended early"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  heading: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 8,
  },
  headingLeft: {
    flex: 1,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 26,
    fontWeight: "600",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    position: "relative",
    overflow: "hidden",
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
  },
  statSmall: {
    fontSize: 11,
    fontWeight: "400",
  },
  statNote: {
    fontSize: 11,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 8,
  },
  progressBarFill: {
    height: "100%",
  },
  watermark: {
    position: "absolute",
    right: 8,
    top: 8,
    fontSize: 32,
    fontWeight: "700",
    color: "rgba(193, 169, 241, 0.08)",
  },
  streakSpark: {
    position: "absolute",
    right: 10,
    top: 8,
    fontSize: 26,
    color: "rgba(239, 180, 147, 0.18)",
  },
  heroCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    backgroundColor: "#18241d",
    position: "relative",
    overflow: "hidden",
  },
  heroKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  heroDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#a6b8a9",
  },
  heroIdleWrap: {},
  heroIdleTitle: {
    fontSize: 26,
    fontWeight: "600",
    color: "#f1f6ef",
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  heroIdleSub: {
    fontSize: 12,
    color: "#a6b8a9",
    marginTop: 6,
    lineHeight: 18,
  },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: 10,
    paddingHorizontal: 16,
    marginTop: 18,
    alignSelf: "flex-start",
  },
  heroPrimaryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#172016",
  },
  heroLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  heroLinkText: {
    fontSize: 11,
    color: "#b9c7b8",
  },
  heroActiveWrap: {},
  heroActiveTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#f1f6ef",
  },
  heroActiveSub: {
    fontSize: 11,
    color: "#a6b8a9",
    marginTop: 2,
  },
  heroActiveTimer: {
    fontSize: 34,
    fontWeight: "600",
    color: "#e2efdc",
    letterSpacing: 0.5,
    marginTop: 10,
    fontVariant: ["tabular-nums"],
  },
  heroBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  splitGrid: {
    gap: 14,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionOverline: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.3,
    marginTop: 2,
  },
  textBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  textBtnLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  ringContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  ringCircle: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  ringPercent: {
    fontSize: 24,
    fontWeight: "600",
    letterSpacing: -0.5,
  },
  ringSub: {
    fontSize: 11,
    marginTop: 2,
  },
  goalNums: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 8,
  },
  goalNumItem: {
    alignItems: "center",
    gap: 3,
  },
  goalNumLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  goalNumVal: {
    fontSize: 14,
    fontWeight: "600",
  },
  goalDivider: {
    width: 1,
    height: 24,
  },
  weekSummaryRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 16,
  },
  weekTotal: {
    fontSize: 22,
    fontWeight: "600",
  },
  weekSub: {
    fontSize: 11,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 110,
    paddingTop: 10,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    height: "100%",
    justifyContent: "flex-end",
  },
  barTrack: {
    width: 18,
    height: 80,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  guardCard: {
    padding: 16,
  },
  guardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  guardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  guardDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 6,
  },
  emptySub: {
    fontSize: 11,
    textAlign: "center",
  },
  sessionList: {
    gap: 10,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  sessionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionName: {
    fontSize: 12,
    fontWeight: "600",
  },
  sessionMeta: {
    fontSize: 10,
    marginTop: 2,
  },
  sessionDuration: {
    fontSize: 13,
    fontWeight: "600",
  },
  sessionState: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
});

