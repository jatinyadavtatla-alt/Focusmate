/**
 * Focus engine: all timer / Pomodoro state transitions live here, free of React.
 * Time is always derived from timestamps stored in SQLite, never from counting ticks,
 * so a session survives backgrounding, process death and reboots.
 */
import * as db from "../db/sqlite";
import type { Pomodoro, Session } from "../db/sqlite";
import { isBreakType, isPomodoroType, liveElapsed } from "../lib/stats";

let clock: () => number = () => Date.now();
export function setClock(fn: () => number) {
  clock = fn;
}
export const nowMs = () => clock();

export type FocusMode = "focus" | "pomodoro" | "stopwatch";
export interface PomodoroRun {
  active: boolean;
  completedFocus: number;
}

/** Sessions shorter than this that the user abandons are treated as accidental taps and dropped. */
export const MIN_KEPT_SECONDS = 10;
/** If JS was away longer than this after a phase ended, don't backdate the next Pomodoro phase. */
const MAX_BACKDATE_MS = 60_000;
const RUN_KEY = "pomodoro_run";

export async function loadRun(): Promise<PomodoroRun> {
  try {
    const raw = await db.getAppState(RUN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { active: !!parsed.active, completedFocus: Number(parsed.completedFocus) || 0 };
    }
  } catch {}
  return { active: false, completedFocus: 0 };
}

async function saveRun(run: PomodoroRun) {
  await db.setAppState(RUN_KEY, JSON.stringify(run));
}

export async function startMode(
  mode: FocusMode,
  minutes: number,
  strict: boolean,
  pomodoro: Pomodoro
): Promise<Session> {
  const existing = await db.getActiveSession();
  if (existing) return existing; // never allow two concurrent sessions

  const startAt = new Date(nowMs());
  if (mode === "stopwatch") {
    await saveRun({ active: false, completedFocus: 0 });
    return db.createSession(null, "stopwatch", strict, startAt);
  }
  if (mode === "pomodoro") {
    await saveRun({ active: true, completedFocus: 0 });
    return db.createSession(pomodoro.focusDuration * 60, "pomodoro_focus", strict, startAt);
  }
  await saveRun({ active: false, completedFocus: 0 });
  return db.createSession(Math.max(1, Math.round(minutes)) * 60, "focus", strict, startAt);
}

export async function pause(s: Session): Promise<Session | null> {
  if (s.status !== "active") return s;
  return db.mutateSession(s.id, "pause", nowMs());
}

export async function resume(s: Session): Promise<Session | null> {
  if (s.status !== "paused") return s;
  return db.mutateSession(s.id, "resume", nowMs());
}

/**
 * The user ends the session (or, in a Pomodoro, skips a break).
 *  - stopwatch → completed (open-ended block finished)
 *  - countdown/pomodoro focus ended before its time → cancelled ("ended early"), time kept
 *  - break → completed
 * Returns the next session when a skipped break chains into focus.
 */
export async function endByUser(
  s: Session,
  opts: { skipBreakToNext?: boolean; pomodoro?: Pomodoro } = {}
): Promise<{ finished: Session | null; next: Session | null }> {
  const now = nowMs();
  const elapsed = liveElapsed(s, now);
  const isBreak = isBreakType(s.sessionType);

  if (!isBreak && elapsed < MIN_KEPT_SECONDS) {
    await db.discardSession(s.id);
    await saveRun({ active: false, completedFocus: 0 });
    return { finished: null, next: null };
  }

  const status = s.sessionType === "stopwatch" || isBreak ? "completed" : "cancelled";
  const finished = await db.finalizeSession(s.id, { status, elapsedSeconds: elapsed, endedAt: new Date(now) });

  if (isBreak && opts.skipBreakToNext && finished) {
    const next = await chainFrom(finished, now);
    if (next) return { finished, next };
  }
  await saveRun({ active: false, completedFocus: 0 });
  return { finished, next: null };
}

/** Phase reached its planned length. Finalises it at its true end time and chains Pomodoro phases. */
export async function completeNaturally(s: Session): Promise<{ finished: Session | null; next: Session | null }> {
  const planned = s.plannedDurationSeconds ?? 0;
  const now = nowMs();
  const segStart = s.segmentStartedAt ? new Date(s.segmentStartedAt).getTime() : now;
  const naturalEnd = Math.min(now, segStart + Math.max(0, planned - s.elapsedSeconds) * 1000);
  const finished = await db.finalizeSession(s.id, {
    status: "completed",
    elapsedSeconds: planned,
    endedAt: new Date(naturalEnd),
  });
  const next = finished ? await chainFrom(finished, naturalEnd) : null;
  if (!next) await saveRun({ active: false, completedFocus: 0 });
  return { finished, next };
}

async function chainFrom(finished: Session, endMs: number): Promise<Session | null> {
  const run = await loadRun();
  if (!run.active || !isPomodoroType(finished.sessionType)) return null;
  const pomo = await db.getPomodoroSettings();
  const startAt = new Date(nowMs() - endMs <= MAX_BACKDATE_MS ? endMs : nowMs());

  if (finished.sessionType === "pomodoro_focus") {
    const completedFocus = run.completedFocus + 1;
    const every = Math.max(1, pomo.sessionsBeforeLongBreak);
    const long = completedFocus % every === 0;
    await saveRun({ active: true, completedFocus });
    return db.createSession(
      (long ? pomo.longBreakDuration : pomo.shortBreakDuration) * 60,
      long ? "long_break" : "short_break",
      finished.strictMode,
      startAt
    );
  }
  await saveRun({ active: true, completedFocus: finished.sessionType === "long_break" ? 0 : run.completedFocus });
  return db.createSession(pomo.focusDuration * 60, "pomodoro_focus", finished.strictMode, startAt);
}

/**
 * Bring state up to date with the wall clock: finalise any session whose time ran out while the
 * app was backgrounded/killed, chaining Pomodoro phases that are still within range.
 */
export async function reconcile(): Promise<{ active: Session | null; completed: Session[] }> {
  let active = await db.getActiveSession();
  const completed: Session[] = [];
  for (let i = 0; i < 20; i++) {
    if (!active || active.status !== "active" || !active.plannedDurationSeconds) break;
    if (liveElapsed(active, nowMs()) < active.plannedDurationSeconds) break;
    const { finished, next } = await completeNaturally(active);
    if (finished) completed.push(finished);
    active = next;
  }
  return { active, completed };
}
