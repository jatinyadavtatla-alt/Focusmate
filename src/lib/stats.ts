import type { Session, Settings } from "../db/sqlite";
import { dayKey, startOfDay, WEEKDAYS } from "./time";

const FOCUS_TYPES = new Set(["focus", "custom", "stopwatch", "pomodoro_focus"]);
const BREAK_TYPES = new Set(["short_break", "long_break"]);

/** A day counts toward the streak once it has at least this much focus. */
export const STREAK_MIN_SECONDS = 5 * 60;

export const isFocusType = (t: string) => FOCUS_TYPES.has(t);
export const isBreakType = (t: string) => BREAK_TYPES.has(t);
export const isPomodoroType = (t: string) => t === "pomodoro_focus" || BREAK_TYPES.has(t);

/** Seconds accumulated by a session, including the live segment of a running one. */
export function liveElapsed(s: Session, nowMs: number): number {
  let total = s.elapsedSeconds;
  if (s.status === "active" && s.segmentStartedAt) {
    total += Math.max(0, Math.floor((nowMs - new Date(s.segmentStartedAt).getTime()) / 1000));
  }
  return total;
}

export function focusSeconds(sessions: Session[], nowMs: number): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (!isFocusType(s.sessionType)) continue;
    const secs = liveElapsed(s, nowMs);
    if (secs <= 0) continue;
    const key = dayKey(s.startedAt);
    byDay.set(key, (byDay.get(key) ?? 0) + secs);
  }
  return byDay;
}

export function currentStreak(byDay: Map<string, number>, nowMs: number): number {
  let streak = 0;
  let offset = 0;
  // Today not having reached the minimum yet shouldn't break a streak.
  if ((byDay.get(dayKey(startOfDay(nowMs, 0))) ?? 0) < STREAK_MIN_SECONDS) offset = -1;
  for (let i = 0; i < 3650; i++) {
    const key = dayKey(startOfDay(nowMs, offset - i));
    if ((byDay.get(key) ?? 0) >= STREAK_MIN_SECONDS) streak++;
    else break;
  }
  return streak;
}

export function longestStreak(byDay: Map<string, number>): number {
  const keys = [...byDay.entries()].filter(([, v]) => v >= STREAK_MIN_SECONDS).map(([k]) => k).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of keys) {
    const [y, m, d] = k.split("-").map(Number);
    const cur = new Date(y, m - 1, d);
    if (prev && Math.round((cur.getTime() - prev.getTime()) / 86400000) === 1) run++;
    else run = 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}

export interface DashboardStats {
  todaySeconds: number;
  goalRatio: number;
  weekDays: { date: Date; key: string; seconds: number; label: string }[];
  maxWeekSeconds: number;
  weekSeconds: number;
  streak: number;
}

export function buildDashboardStats(sessions: Session[], settings: Settings, nowMs: number): DashboardStats {
  const byDay = focusSeconds(sessions, nowMs);
  const weekDays = [];
  for (let i = 6; i >= 0; i--) {
    const date = startOfDay(nowMs, -i);
    const key = dayKey(date);
    weekDays.push({ date, key, seconds: byDay.get(key) ?? 0, label: WEEKDAYS[date.getDay()] });
  }
  const todaySeconds = weekDays[6].seconds;
  const goalSeconds = Math.max(1, settings.dailyGoalMinutes) * 60;
  return {
    todaySeconds,
    goalRatio: Math.min(100, (todaySeconds / goalSeconds) * 100),
    weekDays,
    maxWeekSeconds: Math.max(1, ...weekDays.map((d) => d.seconds)),
    weekSeconds: weekDays.reduce((a, d) => a + d.seconds, 0),
    streak: currentStreak(byDay, nowMs),
  };
}

export interface Analytics {
  rangeDays: number;
  totalSeconds: number;
  previousTotalSeconds: number;
  sessionCount: number;
  completedCount: number;
  endedEarlyCount: number;
  avgSessionSeconds: number;
  longestSessionSeconds: number;
  daysGoalMet: number;
  activeDays: number;
  daily: { key: string; date: Date; seconds: number }[];
  bestDay: { key: string; date: Date; seconds: number } | null;
  byKind: { focus: number; pomodoro: number; stopwatch: number };
  byHour: number[]; // 24 buckets, seconds, by session start hour
  streak: number;
  longestStreak: number;
}

export function buildAnalytics(sessions: Session[], settings: Settings, rangeDays: number, nowMs: number): Analytics {
  const byDayAll = focusSeconds(sessions, nowMs);
  const rangeStart = startOfDay(nowMs, -(rangeDays - 1)).getTime();
  const prevStart = startOfDay(nowMs, -(2 * rangeDays - 1)).getTime();

  const daily = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    const date = startOfDay(nowMs, -i);
    const key = dayKey(date);
    daily.push({ key, date, seconds: byDayAll.get(key) ?? 0 });
  }

  let sessionCount = 0, completedCount = 0, endedEarlyCount = 0, longest = 0, totalAll = 0, previousTotal = 0;
  const byKind = { focus: 0, pomodoro: 0, stopwatch: 0 };
  const byHour = new Array<number>(24).fill(0);

  for (const s of sessions) {
    if (!isFocusType(s.sessionType)) continue;
    const secs = liveElapsed(s, nowMs);
    if (secs <= 0) continue;
    const startMs = new Date(s.startedAt).getTime();
    if (startMs >= rangeStart) {
      totalAll += secs;
      if (s.status === "completed") completedCount++;
      else if (s.status === "cancelled") endedEarlyCount++;
      sessionCount++;
      longest = Math.max(longest, secs);
      if (s.sessionType === "pomodoro_focus") byKind.pomodoro += secs;
      else if (s.sessionType === "stopwatch") byKind.stopwatch += secs;
      else byKind.focus += secs;
      byHour[new Date(s.startedAt).getHours()] += secs;
    } else if (startMs >= prevStart) {
      previousTotal += secs;
    }
  }

  const goalSeconds = Math.max(1, settings.dailyGoalMinutes) * 60;
  const activeDays = daily.filter((d) => d.seconds >= 60).length;
  const best = daily.reduce<Analytics["bestDay"]>((a, d) => (d.seconds > (a?.seconds ?? 0) ? d : a), null);

  return {
    rangeDays,
    totalSeconds: totalAll,
    previousTotalSeconds: previousTotal,
    sessionCount,
    completedCount,
    endedEarlyCount,
    avgSessionSeconds: sessionCount ? Math.round(totalAll / sessionCount) : 0,
    longestSessionSeconds: longest,
    daysGoalMet: daily.filter((d) => d.seconds >= goalSeconds).length,
    activeDays,
    daily,
    bestDay: best,
    byKind,
    byHour,
    streak: currentStreak(byDayAll, nowMs),
    longestStreak: longestStreak(byDayAll),
  };
}
