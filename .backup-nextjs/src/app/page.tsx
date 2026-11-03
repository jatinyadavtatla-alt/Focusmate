"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type SessionStatus = "active" | "paused" | "completed" | "cancelled";
type Session = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  segmentStartedAt: string | null;
  elapsedSeconds: number;
  plannedDurationSeconds: number | null;
  sessionType: string;
  status: SessionStatus;
  completed: boolean;
  strictMode: boolean;
};
type Settings = {
  theme: "system" | "light" | "dark";
  dailyGoalMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  strictModeEnabled: boolean;
};
type Pomodoro = {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
};
type BlockedApp = { packageName: string; appName: string; isEnabled: boolean };
type WebsiteRule = { id: number; domain: string; isEnabled: boolean; createdAt: string };
type TabKey = "home" | "focus" | "analytics" | "blocklist" | "friends" | "settings";
type FocusMode = "focus" | "pomodoro" | "stopwatch";

type IconName =
  | "home" | "timer" | "chart" | "shield" | "users" | "settings" | "sun" | "moon" | "system"
  | "play" | "pause" | "stop" | "plus" | "check" | "bell" | "close" | "leaf" | "clock" | "target"
  | "flame" | "calendar" | "arrow" | "lock" | "link" | "spark" | "music" | "volume" | "skip"
  | "menu" | "chevron" | "refresh" | "info" | "external" | "bolt" | "watch" | "wind" | "search"
  | "more" | "download";

const ICONS: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
  timer: <><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 1.5M9 2h6M12 2v3M19 6l1.5-1.5" /></>,
  chart: <><path d="M4 19V5m0 14h17M8 15l3-4 3 2 5-7" /><circle cx="19" cy="6" r="1" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 1.4 1.1-1.4 2.5-1.8-.6a7 7 0 0 1-1.5.9l-.4 1.9h-2.9l-.4-1.9a7 7 0 0 1-1.5-.9l-1.8.6-1.4-2.5L5.1 15a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.5 1.8.6a7 7 0 0 1 1.5-.9l.4-1.9h2.9l.4 1.9a7 7 0 0 1 1.5.9l1.8-.6 1.4 2.5-1.4 1.1a7 7 0 0 1 0 1.8Z" transform="translate(1 -1) scale(.92)" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></>,
  moon: <><path d="M20.8 13A8.5 8.5 0 0 1 11 3.2 8.5 8.5 0 1 0 20.8 13Z" /></>,
  system: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
  play: <><path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none" /></>,
  pause: <><path d="M8 5h3v14H8zm5 0h3v14h-3z" fill="currentColor" stroke="none" /></>,
  stop: <><rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0" /></>,
  close: <><path d="m18 6-12 12M6 6l12 12" /></>,
  leaf: <><path d="M20 4c-9 0-15 4-15 11a5 5 0 0 0 5 5c7 0 11-6 10-16Z" /><path d="M5 20c2-5 6-8 11-11" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  flame: <><path d="M12 22c4.5 0 7-3 7-7 0-3-1.7-5.6-4.5-8-.2 2-1.3 3.2-2.3 3.8C12.7 7 11 4 8 2c.6 4.3-1.2 6.1-2.8 8.4C3 14 4.5 22 12 22Z" /><path d="M10 17a2 2 0 1 0 4 0c0-1.3-1-2.4-2-3.5-1 1.1-2 2.2-2 3.5Z" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.4 3.4l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7" /></>,
  spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14Z" /></>,
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  volume: <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" /></>,
  skip: <><path d="m5 5 10 7-10 7zM19 5v14" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  chevron: <><path d="m9 18 6-6-6-6" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></>,
  external: <><path d="M14 3h7v7m0-7-10 10" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  bolt: <><path d="m13 2-3 8h7l-6 12 2-9H6l7-11Z" /></>,
  watch: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2 2M9 2h6M9 22h6" /></>,
  wind: <><path d="M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 16h7a3 3 0 1 1-3 3" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M5 20h14" /></>,
};

function Icon({ name, size = 18, className = "" }: { name: IconName; size?: number; className?: string }) {
  return <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]}</svg>;
}

const DEFAULT_SETTINGS: Settings = { theme: "dark", dailyGoalMinutes: 180, soundEnabled: false, vibrationEnabled: true, strictModeEnabled: false };
const DEFAULT_POMODORO: Pomodoro = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsBeforeLongBreak: 4 };
const APP_CATALOG = [
  { packageName: "com.instagram.android", appName: "Instagram", mark: "◎", color: "#d35d91" },
  { packageName: "com.google.android.youtube", appName: "YouTube", mark: "▶", color: "#f05b57" },
  { packageName: "com.zhiliaoapp.musically", appName: "TikTok", mark: "♪", color: "#222a2a" },
  { packageName: "com.reddit.frontpage", appName: "Reddit", mark: "r", color: "#f27845" },
  { packageName: "com.twitter.android", appName: "X", mark: "𝕏", color: "#303535" },
  { packageName: "com.facebook.katana", appName: "Facebook", mark: "f", color: "#4d80e7" },
  { packageName: "tv.twitch.android.app", appName: "Twitch", mark: "▣", color: "#8062dd" },
  { packageName: "com.discord", appName: "Discord", mark: "◈", color: "#697be8" },
];
const FOCUS_TYPES = new Set(["focus", "custom", "stopwatch", "pomodoro_focus"]);

function localDayKey(dateLike: string | Date) {
  const date = new Date(dateLike);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dayStart(offset: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date;
}
function formatClock(totalSeconds: number, forceHours = false) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0 || forceHours) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatMinutes(seconds: number) {
  const minutes = Math.floor(Math.max(seconds, 0) / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}
function formatDate(dateLike: string | Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, options ?? { month: "short", day: "numeric" }).format(new Date(dateLike));
}
function getElapsed(session: Session, now: number) {
  const segment = session.status === "active" && session.segmentStartedAt ? Math.max(0, (now - new Date(session.segmentStartedAt).getTime()) / 1000) : 0;
  return session.elapsedSeconds + segment;
}
function durationLabel(type: string) {
  if (type === "pomodoro_focus") return "Pomodoro focus";
  if (type === "short_break") return "Short break";
  if (type === "long_break") return "Long break";
  if (type === "stopwatch") return "Open focus";
  if (type === "custom") return "Custom focus";
  return "Focus session";
}
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
function sessionDateLabel(session: Session) {
  const date = new Date(session.startedAt);
  if (localDayKey(date) === localDayKey(new Date())) return "Today";
  if (localDayKey(date) === localDayKey(dayStart(-1))) return "Yesterday";
  return formatDate(date, { month: "short", day: "numeric" });
}

export default function HomePage() {
  const [tab, setTab] = useState<TabKey>("home");
  const [mode, setMode] = useState<FocusMode>("focus");
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [pomodoro, setPomodoro] = useState<Pomodoro>(DEFAULT_POMODORO);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [websiteRules, setWebsiteRules] = useState<WebsiteRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState("");
  const [customMinutes, setCustomMinutes] = useState(30);
  const [appSearch, setAppSearch] = useState("");
  const [domainInput, setDomainInput] = useState("");
  const [domainError, setDomainError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [weeklyRange, setWeeklyRange] = useState<7 | 30>(7);
  const [notificationPermission, setNotificationPermission] = useState("default");
  const completionHandled = useRef<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionBusy = useRef(false);

  const activeSession = useMemo(() => sessions.find((session) => session.status === "active" || session.status === "paused") ?? null, [sessions]);
  const activeElapsed = activeSession ? getElapsed(activeSession, now) : 0;
  const remainingSeconds = activeSession?.plannedDurationSeconds ? Math.max(0, activeSession.plannedDurationSeconds - activeElapsed) : activeElapsed;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(""), 3400);
  }, []);

  const applyState = useCallback((data: Record<string, unknown>) => {
    if (data.settings && typeof data.settings === "object") setSettings({ ...DEFAULT_SETTINGS, ...(data.settings as Partial<Settings>) });
    if (data.pomodoro && typeof data.pomodoro === "object") setPomodoro({ ...DEFAULT_POMODORO, ...(data.pomodoro as Partial<Pomodoro>) });
    if (Array.isArray(data.sessions)) setSessions(data.sessions as Session[]);
    if (Array.isArray(data.blockedApps)) setBlockedApps(data.blockedApps as BlockedApp[]);
    if (Array.isArray(data.websiteRules)) setWebsiteRules(data.websiteRules as WebsiteRule[]);
  }, []);

  const refreshState = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Unable to load your data.");
      applyState(data);
      try { localStorage.setItem("focusmate-last-state", JSON.stringify(data)); } catch { /* storage can be unavailable in private browsing */ }
    } catch (error) {
      try {
        const backup = localStorage.getItem("focusmate-last-state");
        if (backup) applyState(JSON.parse(backup) as Record<string, unknown>);
      } catch { /* keep the empty state if local storage is unavailable */ }
      if (!quiet) showToast(error instanceof Error ? error.message : "Could not connect to your local database.");
    } finally {
      setLoading(false);
    }
  }, [applyState, showToast]);

  useEffect(() => { void refreshState(); }, [refreshState]);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const syncClock = () => setNow(Date.now());
    document.addEventListener("visibilitychange", syncClock);
    window.addEventListener("focus", syncClock);
    return () => {
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", syncClock);
      window.removeEventListener("focus", syncClock);
    };
  }, []);
  useEffect(() => {
    const applyTheme = () => {
      const resolved = settings.theme === "system"
        ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
        : settings.theme;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    };
    applyTheme();
    if (settings.theme === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
  }, [settings.theme]);
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotificationPermission(Notification.permission);
  }, []);
  useEffect(() => {
    if (activeSession && activeSession.sessionType.startsWith("pomodoro")) setMode("pomodoro");
    if (activeSession?.sessionType === "stopwatch") setMode("stopwatch");
  }, [activeSession]);

  const focusSessions = useMemo(() => sessions.filter((session) => FOCUS_TYPES.has(session.sessionType)), [sessions]);
  const completedFocusSessions = useMemo(() => focusSessions.filter((session) => session.status === "completed" && session.completed), [focusSessions]);
  const sessionsToday = useMemo(() => completedFocusSessions.filter((session) => localDayKey(session.startedAt) === localDayKey(new Date())), [completedFocusSessions]);
  const todaySeconds = useMemo(() => {
    const completed = sessionsToday.reduce((sum, session) => sum + session.elapsedSeconds, 0);
    const live = activeSession && FOCUS_TYPES.has(activeSession.sessionType) && localDayKey(activeSession.startedAt) === localDayKey(new Date()) ? activeElapsed : 0;
    return completed + live;
  }, [sessionsToday, activeSession, activeElapsed]);
  const streak = useMemo(() => {
    const keys = new Set(completedFocusSessions.map((session) => localDayKey(session.startedAt)));
    let cursor = dayStart(0);
    if (!keys.has(localDayKey(cursor))) cursor = dayStart(-1);
    if (!keys.has(localDayKey(cursor))) return 0;
    let count = 0;
    while (keys.has(localDayKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [completedFocusSessions]);
  const goalRatio = Math.min(100, (todaySeconds / Math.max(1, settings.dailyGoalMinutes * 60)) * 100);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = dayStart(index - 6);
    const key = localDayKey(date);
    const seconds = completedFocusSessions.filter((session) => localDayKey(session.startedAt) === key).reduce((sum, session) => sum + session.elapsedSeconds, 0)
      + (activeSession && FOCUS_TYPES.has(activeSession.sessionType) && localDayKey(activeSession.startedAt) === key ? activeElapsed : 0);
    return { date, key, seconds, label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date) };
  }), [completedFocusSessions, activeSession, activeElapsed]);
  const weekSeconds = weekDays.reduce((sum, day) => sum + day.seconds, 0);
  const monthSeconds = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return completedFocusSessions.filter((session) => {
      const date = new Date(session.startedAt);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).reduce((sum, session) => sum + session.elapsedSeconds, 0);
  }, [completedFocusSessions]);
  const avgSessionSeconds = completedFocusSessions.length
    ? Math.round(completedFocusSessions.reduce((sum, session) => sum + session.elapsedSeconds, 0) / completedFocusSessions.length)
    : 0;
  const maxWeekSeconds = Math.max(...weekDays.map((day) => day.seconds), 60);
  const maxWeekday = [...weekDays].sort((a, b) => b.seconds - a.seconds)[0];
  const pomodoroCount = completedFocusSessions.filter((session) => session.sessionType === "pomodoro_focus").length;
  const cycleNumber = (pomodoroCount % Math.max(1, pomodoro.sessionsBeforeLongBreak)) + 1;
  const recentSessions = [...sessions].filter((session) => session.status === "completed" || session.status === "cancelled").slice(0, 5);

  const updateSessionInList = useCallback((updated: Session) => {
    setSessions((current) => [updated, ...current.filter((session) => session.id !== updated.id)].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()));
  }, []);

  const startSession = useCallback(async (plannedDurationSeconds: number | null, sessionType: string, strictMode: boolean) => {
    if (sessionBusy.current) return null;
    sessionBusy.current = true;
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plannedDurationSeconds, sessionType, strictMode }),
      });
      const data = await response.json() as { session?: Session; error?: string };
      if (!response.ok) {
        if (data.session) updateSessionInList(data.session);
        throw new Error(data.error ?? "Could not start a focus session.");
      }
      if (!data.session) throw new Error("The session was not saved.");
      completionHandled.current = null;
      updateSessionInList(data.session);
      setTab("focus");
      showToast(sessionType.includes("break") ? "Break started. Enjoy a little breathing room." : "Focus session started. You’ve got this.");
      return data.session;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not start a focus session.");
      return null;
    } finally {
      sessionBusy.current = false;
    }
  }, [showToast, updateSessionInList]);

  const playFinishCue = useCallback(() => {
    if (settings.vibrationEnabled && "vibrate" in navigator) navigator.vibrate([120, 70, 180]);
    if (settings.soundEnabled) {
      try {
        const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const context = new AudioContextClass();
          [659.25, 783.99, 1046.5].forEach((frequency, index) => {
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.frequency.value = frequency;
            oscillator.type = "sine";
            gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.18);
            gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + index * 0.18 + 0.025);
            gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.18 + 0.42);
            oscillator.connect(gain);
            gain.connect(context.destination);
            oscillator.start(context.currentTime + index * 0.18);
            oscillator.stop(context.currentTime + index * 0.18 + 0.43);
          });
          window.setTimeout(() => void context.close(), 1000);
        }
      } catch { /* sound is optional; never interrupt the timer */ }
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("FocusMate", { body: "Your focus block is complete. Take a breath before the next one." });
    }
  }, [settings.soundEnabled, settings.vibrationEnabled]);

  const updateSession = useCallback(async (session: Session, action: "pause" | "resume" | "finish" | "cancel", autoAdvance = false) => {
    if (sessionBusy.current) return;
    sessionBusy.current = true;
    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json() as { session?: Session; error?: string };
      if (!response.ok || !data.session) throw new Error(data.error ?? "Could not update the session.");
      updateSessionInList(data.session);
      if (action === "finish") {
        playFinishCue();
        showToast("Session complete. Nicely done.");
        if (autoAdvance && mode === "pomodoro") {
          if (session.sessionType === "pomodoro_focus") {
            const finishedCount = completedFocusSessions.filter((item) => item.sessionType === "pomodoro_focus").length + 1;
            const isLong = finishedCount % pomodoro.sessionsBeforeLongBreak === 0;
            const nextType = isLong ? "long_break" : "short_break";
            const nextMinutes = isLong ? pomodoro.longBreakDuration : pomodoro.shortBreakDuration;
            window.setTimeout(() => { void startSession(nextMinutes * 60, nextType, false); }, 900);
          } else if (session.sessionType === "short_break" || session.sessionType === "long_break") {
            window.setTimeout(() => { void startSession(pomodoro.focusDuration * 60, "pomodoro_focus", settings.strictModeEnabled); }, 900);
          }
        }
      } else if (action === "cancel") {
        showToast("Session ended. Your progress is still in your history.");
      } else {
        showToast(action === "pause" ? "Timer paused." : "Back to it. Timer resumed.");
      }
      void refreshState(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update the session.");
    } finally {
      sessionBusy.current = false;
    }
  }, [completedFocusSessions, mode, pomodoro, playFinishCue, refreshState, settings.strictModeEnabled, showToast, startSession, updateSessionInList]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active" || activeSession.plannedDurationSeconds === null) return;
    if (remainingSeconds > 0 || completionHandled.current === activeSession.id) return;
    completionHandled.current = activeSession.id;
    void updateSession(activeSession, "finish", true);
  }, [activeSession, remainingSeconds, updateSession]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") return;
    type WakeLock = { release: () => Promise<void> };
    type WakeLockNavigator = Navigator & { wakeLock?: { request: (type: "screen") => Promise<WakeLock> } };
    let lock: WakeLock | undefined;
    let cancelled = false;
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (wakeLock) void wakeLock.request("screen").then((result) => { if (cancelled) void result.release(); else lock = result; }).catch(() => undefined);
    return () => { cancelled = true; if (lock) void lock.release().catch(() => undefined); };
  }, [activeSession]);

  const savePreferences = useCallback(async (patch: Partial<Settings>, nextPomodoro?: Pomodoro) => {
    const previousSettings = settings;
    const previousPomodoro = pomodoro;
    const nextSettings = { ...settings, ...patch };
    setSettings(nextSettings);
    if (nextPomodoro) setPomodoro(nextPomodoro);
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, ...(nextPomodoro ? { pomodoro: nextPomodoro } : {}) }),
      });
      const data = await response.json() as { settings?: Settings; pomodoro?: Pomodoro; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save settings.");
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      if (data.pomodoro) setPomodoro({ ...DEFAULT_POMODORO, ...data.pomodoro });
      showToast("Preferences saved.");
    } catch (error) {
      setSettings(previousSettings);
      setPomodoro(previousPomodoro);
      showToast(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setIsSaving(false);
    }
  }, [pomodoro, settings, showToast]);

  const setAppSelection = async (nextApps: BlockedApp[]) => {
    setBlockedApps(nextApps);
    try {
      const response = await fetch("/api/blocked-apps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apps: nextApps }),
      });
      const data = await response.json() as { apps?: BlockedApp[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not save app selection.");
      setBlockedApps(data.apps ?? nextApps);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save app selection.");
      void refreshState(true);
    }
  };

  const toggleApp = (app: typeof APP_CATALOG[number]) => {
    const exists = blockedApps.some((saved) => saved.packageName === app.packageName && saved.isEnabled);
    const next = exists
      ? blockedApps.filter((saved) => saved.packageName !== app.packageName)
      : [...blockedApps.filter((saved) => saved.packageName !== app.packageName), { packageName: app.packageName, appName: app.appName, isEnabled: true }];
    void setAppSelection(next);
  };

  const addWebsite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDomainError("");
    try {
      const response = await fetch("/api/websites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain: domainInput }) });
      const data = await response.json() as { rule?: WebsiteRule; error?: string };
      if (!response.ok || !data.rule) throw new Error(data.error ?? "Could not save domain.");
      setWebsiteRules((current) => current.some((rule) => rule.id === data.rule?.id) ? current : [...current, data.rule as WebsiteRule].sort((a, b) => a.domain.localeCompare(b.domain)));
      setDomainInput("");
      showToast("Domain added to your planning list.");
    } catch (error) {
      setDomainError(error instanceof Error ? error.message : "Could not save domain.");
    }
  };

  const removeWebsite = async (id: number) => {
    try {
      const response = await fetch(`/api/websites?id=${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove this domain.");
      setWebsiteRules((current) => current.filter((rule) => rule.id !== id));
      showToast("Domain removed.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not remove this domain.");
    }
  };

  const startCurrentMode = () => {
    if (mode === "stopwatch") return void startSession(null, "stopwatch", settings.strictModeEnabled);
    const duration = mode === "pomodoro" ? pomodoro.focusDuration * 60 : Math.max(1, customMinutes) * 60;
    const type = mode === "pomodoro" ? "pomodoro_focus" : "focus";
    void startSession(duration, type, settings.strictModeEnabled);
  };

  const startFromHome = () => {
    setMode("focus");
    void startSession(30 * 60, "focus", settings.strictModeEnabled);
  };

  const requestNotifications = async () => {
    if (!("Notification" in window)) {
      showToast("This browser does not support desktop notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    showToast(permission === "granted" ? "Session notifications enabled." : "Notifications were not enabled.");
  };

  const focusMode = (next: FocusMode) => {
    if (activeSession) {
      showToast("Finish or pause your current session before changing timers.");
      return;
    }
    setMode(next);
  };

  const nav = [
    { key: "home" as const, label: "Overview", icon: "home" as const, group: "SPACE" },
    { key: "focus" as const, label: "Focus timer", icon: "timer" as const, group: "SPACE" },
    { key: "analytics" as const, label: "Insights", icon: "chart" as const, group: "TRACK" },
    { key: "blocklist" as const, label: "Focus guard", icon: "shield" as const, group: "TRACK" },
    { key: "friends" as const, label: "Study circle", icon: "users" as const, group: "YOU" },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Icon name="leaf" size={20} /></div>
          <div><span className="brand-name">focusmate</span><span className="brand-caption">MAKE ROOM TO FOCUS</span></div>
        </div>
        <div className="sidebar-profile">
          <div className="profile-avatar">J</div>
          <div className="profile-copy"><strong>Your focus space</strong><span>Personal workspace</span></div>
        </div>
        <nav className="side-navigation" aria-label="Main navigation">
          {nav.map((item, index) => (
            <div key={item.key}>
              {(index === 0 || nav[index - 1].group !== item.group) && <div className="nav-group-label">{item.group}</div>}
              <button className={`nav-item ${tab === item.key ? "active" : ""}`} onClick={() => setTab(item.key)} aria-current={tab === item.key ? "page" : undefined}>
                <Icon name={item.icon} size={18} /><span>{item.label}</span>
                {item.key === "focus" && activeSession && <span className="nav-live-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-quote">
          <div className="quote-icon"><Icon name="spark" size={16} /></div>
          <p>“Almost everything will work again if you unplug it for a few minutes.”</p>
          <span>ANNE LAMOTT</span>
        </div>
        <button className={`nav-item settings-link ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>
          <Icon name="settings" size={18} /><span>Settings</span><span className="shortcut">⌘ ,</span>
        </button>
        <div className="sidebar-footer"><span className="status-dot" /> Your focus data stays private</div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><Icon name="leaf" size={18} /></div><span>focusmate</span></div>
          <div className="breadcrumb"><span>Personal space</span><Icon name="chevron" size={14} /><strong>{nav.find((item) => item.key === tab)?.label ?? (tab === "settings" ? "Settings" : "FocusMate")}</strong></div>
          <div className="topbar-actions">
            <span className="privacy-pill"><span className="status-dot" /> Private by design</span>
            <button className="icon-button" onClick={() => void refreshState()} aria-label="Refresh data"><Icon name="refresh" size={17} /></button>
            <button className="top-avatar" onClick={() => setTab("settings")} aria-label="Open settings">J</button>
          </div>
        </header>

        <div className="content-wrap">
          {tab === "home" && <Dashboard
            loading={loading} settings={settings} sessions={sessions} completedSessions={completedFocusSessions} recentSessions={recentSessions}
            activeSession={activeSession} activeElapsed={activeElapsed} todaySeconds={todaySeconds} goalRatio={goalRatio} weekDays={weekDays}
            maxWeekSeconds={maxWeekSeconds} streak={streak} weekSeconds={weekSeconds} onStart={startFromHome} onGoFocus={() => setTab("focus")}
            onGoAnalytics={() => setTab("analytics")} onGoGuard={() => setTab("blocklist")} onGoSettings={() => setTab("settings")} onPause={() => activeSession && void updateSession(activeSession, activeSession.status === "active" ? "pause" : "resume")}
          />}
          {tab === "focus" && <FocusPage
            mode={mode} setMode={focusMode} settings={settings} pomodoro={pomodoro} activeSession={activeSession} elapsed={activeElapsed}
            remaining={remainingSeconds} customMinutes={customMinutes} setCustomMinutes={setCustomMinutes} cycleNumber={cycleNumber}
            onStart={startCurrentMode} onPause={() => activeSession && void updateSession(activeSession, activeSession.status === "active" ? "pause" : "resume")}
            onFinish={() => activeSession && void updateSession(activeSession, "cancel")} onComplete={() => activeSession && void updateSession(activeSession, "finish")}
            onToggleStrict={() => void savePreferences({ strictModeEnabled: !settings.strictModeEnabled })} onGoGuard={() => setTab("blocklist")}
          />}
          {tab === "analytics" && <AnalyticsPage
            sessions={completedFocusSessions} weekDays={weekDays} weekSeconds={weekSeconds} monthSeconds={monthSeconds} todaySeconds={todaySeconds}
            avgSessionSeconds={avgSessionSeconds} streak={streak} goalMinutes={settings.dailyGoalMinutes} range={weeklyRange} setRange={setWeeklyRange}
          />}
          {tab === "blocklist" && <FocusGuardPage
            apps={blockedApps} websites={websiteRules} appSearch={appSearch} setAppSearch={setAppSearch} onToggleApp={toggleApp}
            domainInput={domainInput} setDomainInput={setDomainInput} domainError={domainError} onAddWebsite={addWebsite} onRemoveWebsite={removeWebsite}
            onGoFocus={() => setTab("focus")}
          />}
          {tab === "friends" && <FriendsPage sessions={completedFocusSessions.length} />}
          {tab === "settings" && <SettingsPage
            settings={settings} pomodoro={pomodoro} saving={isSaving} notificationPermission={notificationPermission}
            onSave={savePreferences} onNotifications={requestNotifications} onGoGuard={() => setTab("blocklist")}
          />}
        </div>
        <footer className="main-footer"><span>FOCUSMATE · PERSONAL PRODUCTIVITY</span><span>Built for quieter, deeper work <Icon name="leaf" size={13} /></span></footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={tab === item.key ? "active" : ""} aria-label={item.label}><Icon name={item.icon} size={20} /><span>{item.label}</span></button>)}
        <button onClick={() => setTab("settings")} className={tab === "settings" ? "active" : ""} aria-label="Settings"><Icon name="settings" size={20} /><span>Settings</span></button>
      </nav>
      {toast && <div className="toast" role="status"><span className="toast-mark"><Icon name="check" size={16} /></span>{toast}<button aria-label="Dismiss message" onClick={() => setToast("")}><Icon name="close" size={15} /></button></div>}
    </main>
  );
}

type ChartDay = { date: Date; key: string; seconds: number; label: string };

function Dashboard(props: {
  loading: boolean; settings: Settings; sessions: Session[]; completedSessions: Session[]; recentSessions: Session[]; activeSession: Session | null;
  activeElapsed: number; todaySeconds: number; goalRatio: number; weekDays: ChartDay[]; maxWeekSeconds: number; streak: number; weekSeconds: number;
  onStart: () => void; onGoFocus: () => void; onGoAnalytics: () => void; onGoGuard: () => void; onGoSettings: () => void; onPause: () => void;
}) {
  const {
    loading, settings, completedSessions, recentSessions, activeSession, activeElapsed, todaySeconds, goalRatio, weekDays,
    maxWeekSeconds, streak, weekSeconds, onStart, onGoFocus, onGoAnalytics, onGoGuard, onGoSettings, onPause,
  } = props;
  const todayCount = completedSessions.filter((session) => localDayKey(session.startedAt) === localDayKey(new Date())).length;
  const dayText = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const ringStyle = { "--ring-progress": `${goalRatio * 3.6}deg` } as React.CSSProperties;
  return <>
    <div className="page-heading dashboard-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR DAY, AT YOUR PACE</div><h1>{greeting()}, Jatin <span className="wave-hand">✳</span></h1><p className="page-subtitle">A little focus goes a long way. Here’s your space for today.</p></div>
      <div className="date-chip"><Icon name="calendar" size={16} /><span>{dayText}</span></div>
    </div>

    <section className="stats-row" aria-label="Today's productivity summary">
      <div className="stat-card">
        <div className="stat-icon icon-green"><Icon name="clock" size={18} /></div>
        <div className="stat-content"><span className="stat-label">FOCUSED TODAY</span><strong>{formatMinutes(todaySeconds)}</strong><span className="stat-note">of {Math.floor(settings.dailyGoalMinutes / 60)}h {settings.dailyGoalMinutes % 60 ? `${settings.dailyGoalMinutes % 60}m` : ""} daily goal</span></div>
        <div className="stat-mini"><div style={{ width: `${goalRatio}%` }} /></div>
      </div>
      <div className="stat-card">
        <div className="stat-icon icon-lilac"><Icon name="target" size={18} /></div>
        <div className="stat-content"><span className="stat-label">SESSIONS TODAY</span><strong>{todayCount}<small> {todayCount === 1 ? "session" : "sessions"}</small></strong><span className="stat-note">{activeSession && activeSession.status === "active" ? "One in progress now" : "Every block counts"}</span></div>
        <span className="stat-watermark">{String(todayCount).padStart(2, "0")}</span>
      </div>
      <div className="stat-card">
        <div className="stat-icon icon-peach"><Icon name="flame" size={18} /></div>
        <div className="stat-content"><span className="stat-label">CURRENT STREAK</span><strong>{streak}<small> {streak === 1 ? "day" : "days"}</small></strong><span className="stat-note">{streak ? "Keep your rhythm going" : "A fresh start is one session away"}</span></div>
        <span className="streak-spark">✦</span>
      </div>
    </section>

    <section className="dashboard-grid dashboard-top-grid">
      <div className={`focus-hero ${activeSession ? "session-active" : ""}`}>
        <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-orbit orbit-three" />
        <div className="hero-content">
          <div className="hero-kicker"><span className="hero-kicker-dot" /> YOUR FOCUS SPACE</div>
          {activeSession ? <>
            <h2>{activeSession.status === "paused" ? "On a little pause." : "You’re in the zone."}</h2>
            <p>{durationLabel(activeSession.sessionType)} · {activeSession.strictMode ? "Strict mode on" : "No pressure, just focus"}</p>
            <div className="hero-timer">{formatClock(activeSession.plannedDurationSeconds ? Math.max(0, activeSession.plannedDurationSeconds - activeElapsed) : activeElapsed)}</div>
            <button className="button button-accent hero-button" onClick={activeSession.status === "paused" ? onPause : onGoFocus}><span>{activeSession.status === "paused" ? "Resume session" : "Open timer"}</span><Icon name="arrow" size={16} /></button>
          </> : <>
            <h2>Make space for<br />what matters.</h2>
            <p>One intentional block can change the shape of your day.</p>
            <button className="button button-accent hero-button" onClick={onStart}><Icon name="play" size={15} /><span>Start a 30 min focus</span><Icon name="arrow" size={16} /></button>
            <button className="hero-text-link" onClick={onGoFocus}>Choose a different timer <Icon name="arrow" size={14} /></button>
          </>}
        </div>
        <div className="hero-art" aria-hidden="true"><div className="hero-plant"><span className="plant-leaf leaf-a" /><span className="plant-leaf leaf-b" /><span className="plant-leaf leaf-c" /><span className="plant-leaf leaf-d" /><span className="plant-leaf leaf-e" /><span className="plant-stem" /></div><div className="hero-ground" /></div>
        <div className="hero-plant-caption"><span>01</span><span>PAUSE · BREATHE · BEGIN</span></div>
      </div>

      <div className="goal-card surface-card">
        <div className="card-heading"><div><span className="section-overline">A GENTLE TARGET</span><h3>Daily intention</h3></div><button className="icon-button small" onClick={onGoSettings} aria-label="Edit daily goal"><Icon name="more" size={17} /></button></div>
        <div className="goal-ring-wrap"><div className="goal-ring" style={ringStyle}><div className="goal-ring-center"><strong>{Math.round(goalRatio)}<small>%</small></strong><span>of your goal</span></div></div></div>
        <div className="goal-numbers"><div><span>FOCUSED</span><strong>{formatMinutes(todaySeconds)}</strong></div><div className="goal-divider" /><div><span>DAILY GOAL</span><strong>{settings.dailyGoalMinutes >= 60 ? `${settings.dailyGoalMinutes / 60}h` : `${settings.dailyGoalMinutes}m`}</strong></div></div>
        <button className="goal-edit" onClick={onGoSettings}>Edit your daily intention <Icon name="arrow" size={14} /></button>
      </div>
    </section>

    <section className="dashboard-grid dashboard-lower-grid">
      <div className="surface-card weekly-card">
        <div className="card-heading"><div><span className="section-overline">SHOWING UP ADDS UP</span><h3>Your week, in focus</h3></div><button className="text-button" onClick={onGoAnalytics}>Full insights <Icon name="arrow" size={14} /></button></div>
        <div className="weekly-summary"><strong>{formatMinutes(weekSeconds)}</strong><span>total this week</span><span className="weekly-summary-divider" /><span className="weekly-trend"><Icon name="spark" size={13} /> A day at a time</span></div>
        <div className="week-chart" role="img" aria-label="Focus time over the last seven days">
          {weekDays.map((day, index) => <div className={`week-column ${index === 6 ? "is-today" : ""}`} key={day.key}>
            <div className="week-bar-track"><div className="week-bar" style={{ height: `${day.seconds ? Math.max(8, day.seconds / maxWeekSeconds * 100) : 3}%` }} title={`${day.label}: ${formatMinutes(day.seconds)}`} /></div>
            <span className="week-day-label">{day.label.slice(0, 1)}</span>
            <span className="week-day-dot" />
          </div>)}
        </div>
        <div className="chart-baseline"><span>LESS</span><div /><span>MORE FOCUS</span></div>
      </div>
      <div className="surface-card guard-card">
        <div className="card-heading"><div><span className="section-overline">KEEP YOUR ATTENTION CLOSE</span><h3>Focus guard</h3></div><div className="guard-icon"><Icon name="shield" size={18} /></div></div>
        <p className="guard-description">Choose the apps and sites you’d like to step away from during focus time.</p>
        <div className="guard-status"><div className="guard-status-icon"><Icon name="info" size={16} /></div><div><strong>Planning list only in this browser</strong><span>Enforcement needs a native Android companion.</span></div></div>
        <div className="guard-footer"><div className="app-stack" aria-hidden="true">{APP_CATALOG.slice(0, 3).map((app) => <span key={app.packageName} style={{ background: app.color }}>{app.mark}</span>)}</div><span>{props.sessions.length ? `${props.sessions.length} recorded sessions` : "Your list is ready when you are"}</span><button className="circle-arrow" onClick={onGoGuard} aria-label="Configure focus guard"><Icon name="arrow" size={16} /></button></div>
      </div>
    </section>

    <section className="surface-card recent-card">
      <div className="card-heading"><div><span className="section-overline">A LOOK BACK</span><h3>Recent sessions</h3></div><button className="text-button" onClick={onGoAnalytics}>See all <Icon name="arrow" size={14} /></button></div>
      {loading && recentSessions.length === 0 ? <div className="loading-line"><span className="loading-spinner" /> Loading your sessions…</div> : recentSessions.length === 0 ? <div className="empty-state compact-empty"><div className="empty-orbit"><Icon name="leaf" size={20} /></div><div><strong>Your first session starts here</strong><p>Once you complete a focus block, it’ll show up here.</p></div><button className="text-button" onClick={onGoFocus}>Set a timer <Icon name="arrow" size={14} /></button></div> : <div className="session-list">{recentSessions.slice(0, 4).map((session) => <SessionRow key={session.id} session={session} />)}</div>}
    </section>
  </>;
}

function SessionRow({ session }: { session: Session }) {
  const isComplete = session.status === "completed";
  const typeIcon: IconName = session.sessionType.includes("break") ? "leaf" : "timer";
  return <div className="session-row">
    <div className={`session-row-icon ${isComplete ? "done" : "stopped"}`}><Icon name={typeIcon} size={17} /></div>
    <div className="session-row-main"><strong>{durationLabel(session.sessionType)}</strong><span>{sessionDateLabel(session)} · {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(session.startedAt))}{session.strictMode ? " · Strict" : ""}</span></div>
    <div className="session-row-duration"><strong>{formatMinutes(session.elapsedSeconds)}</strong><span className={`session-state ${isComplete ? "complete" : "ended"}`}>{isComplete ? "Complete" : "Ended early"}</span></div>
  </div>;
}

function FocusPage(props: {
  mode: FocusMode; setMode: (mode: FocusMode) => void; settings: Settings; pomodoro: Pomodoro; activeSession: Session | null;
  elapsed: number; remaining: number; customMinutes: number; setCustomMinutes: (minutes: number) => void; cycleNumber: number;
  onStart: () => void; onPause: () => void; onFinish: () => void; onComplete: () => void; onToggleStrict: () => void; onGoGuard: () => void;
}) {
  const { mode, setMode, settings, pomodoro, activeSession, elapsed, remaining, customMinutes, setCustomMinutes, cycleNumber, onStart, onPause, onFinish, onComplete, onToggleStrict, onGoGuard } = props;
  const [confirmStrictExit, setConfirmStrictExit] = useState(false);
  const endActiveSession = () => {
    if (activeSession?.sessionType === "stopwatch") onComplete();
    else onFinish();
  };
  const requestEndSession = () => {
    if (activeSession?.strictMode) setConfirmStrictExit(true);
    else endActiveSession();
  };
  const progress = activeSession?.plannedDurationSeconds ? Math.min(1, elapsed / activeSession.plannedDurationSeconds) : 0;
  const radius = 138;
  const circumference = Math.PI * radius * 2;
  const type = activeSession?.sessionType ?? (mode === "pomodoro" ? "pomodoro_focus" : mode === "stopwatch" ? "stopwatch" : "focus");
  const displaySeconds = activeSession ? (activeSession.plannedDurationSeconds ? remaining : elapsed) : mode === "pomodoro" ? pomodoro.focusDuration * 60 : mode === "focus" ? customMinutes * 60 : 0;
  const isBreak = type === "short_break" || type === "long_break";
  const timerTitle = activeSession ? (isBreak ? "Take a little breather" : activeSession.status === "paused" ? "Paused, whenever you’re ready" : "You’re right where you need to be") : mode === "pomodoro" ? "One thing at a time." : mode === "stopwatch" ? "Let it flow." : "Give one thing your attention.";
  const timerSub = activeSession ? (activeSession.status === "paused" ? "Your time is safely saved." : isBreak ? "Step away from the screen for a moment." : "Stay with this moment. The rest can wait.") : mode === "pomodoro" ? `Focus ${pomodoro.focusDuration} min · Break ${pomodoro.shortBreakDuration} min · Long break every ${pomodoro.sessionsBeforeLongBreak}` : mode === "stopwatch" ? "An open-ended session. Stop whenever it feels right." : "A quiet block of time, set aside for what matters.";
  return <>
    <div className="page-heading focus-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> SETTLE INTO YOUR WORK</div><h1>Focus, your way.</h1><p className="page-subtitle">A little structure, a lot of room to think.</p></div>
      <div className={`active-pill ${activeSession ? "running" : ""}`}><span className="status-dot" />{activeSession ? (activeSession.status === "paused" ? "Paused session" : "Session in progress") : "Ready when you are"}</div>
    </div>
    <div className="focus-layout">
      <section className="timer-stage surface-card">
        <div className="timer-mode-switch" role="tablist" aria-label="Timer mode">
          {([ ["focus", "Focus timer"], ["pomodoro", "Pomodoro"], ["stopwatch", "Stopwatch"] ] as const).map(([key, label]) => <button key={key} role="tab" aria-selected={mode === key} className={mode === key ? "selected" : ""} onClick={() => setMode(key)}>{label}{key === "pomodoro" && <span className="mode-new">FLOW</span>}</button>)}
        </div>
        <div className="timer-heading"><span className="section-overline">{activeSession ? durationLabel(activeSession.sessionType).toUpperCase() : mode === "pomodoro" ? `POMODORO · ROUND ${cycleNumber}` : mode === "stopwatch" ? "OPEN-ENDED SESSION" : "CUSTOM FOCUS BLOCK"}</span><h2>{timerTitle}</h2><p>{timerSub}</p></div>
        <div className={`timer-dial-wrap ${activeSession?.status === "paused" ? "is-paused" : ""}`}>
          <div className="timer-dial-glow" />
          <svg className="timer-dial" viewBox="0 0 320 320" aria-label={`Timer: ${formatClock(displaySeconds)}`}>
            <circle className="timer-dial-track" cx="160" cy="160" r={radius} />
            <circle className="timer-dial-progress" cx="160" cy="160" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} transform="rotate(-90 160 160)" />
            <circle className="timer-dial-node" cx="160" cy="22" r="5" />
          </svg>
          <div className="timer-dial-center">
            <div className="dial-phase"><span className={`phase-dot ${isBreak ? "break-phase" : ""}`} />{activeSession ? (isBreak ? "REST" : activeSession.status === "paused" ? "PAUSED" : "IN THE FLOW") : mode === "pomodoro" ? "FOCUS ROUND" : mode === "stopwatch" ? "ELAPSED" : "TIME TO FOCUS"}</div>
            <div className="dial-time">{formatClock(displaySeconds, mode === "stopwatch" && displaySeconds >= 3600)}</div>
            <div className="dial-caption">{mode === "stopwatch" ? (activeSession ? "time well spent" : "no clock, no pressure") : activeSession?.plannedDurationSeconds ? `${Math.ceil(remaining / 60)} minutes to go` : activeSession ? "time well spent" : "minutes"}</div>
          </div>
        </div>
        {!activeSession && mode === "focus" && <div className="custom-duration"><span>SESSION LENGTH</span><div className="duration-control"><button className="duration-step" aria-label="Decrease session by 5 minutes" onClick={() => setCustomMinutes(Math.max(5, customMinutes - 5))}><span>−</span></button><strong>{customMinutes}<small> min</small></strong><button className="duration-step" aria-label="Increase session by 5 minutes" onClick={() => setCustomMinutes(Math.min(180, customMinutes + 5))}><Icon name="plus" size={15} /></button></div><div className="duration-presets">{[25, 30, 45, 60].map((minutes) => <button key={minutes} className={customMinutes === minutes ? "chosen" : ""} onClick={() => setCustomMinutes(minutes)}>{minutes} min</button>)}</div></div>}
        {activeSession && <div className="live-session-meta"><span><Icon name="clock" size={14} /> Started {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(activeSession.startedAt))}</span>{activeSession.strictMode && <span className="strict-mini"><Icon name="lock" size={13} /> Strict on</span>}</div>}
        <div className="timer-controls">
          {!activeSession ? <button className="button button-accent timer-start-button" onClick={onStart}><Icon name="play" size={16} />Begin focus</button> : <>
            <button className="button button-accent timer-start-button" onClick={onPause}><Icon name={activeSession.status === "paused" ? "play" : "pause"} size={16} />{activeSession.status === "paused" ? "Resume" : "Pause"}</button>
            <button className="button button-outline timer-secondary-button" onClick={requestEndSession}><Icon name="stop" size={14} />{activeSession.sessionType === "stopwatch" ? "Stop & save" : "End session"}</button>
            {activeSession.plannedDurationSeconds !== null && <button className="timer-complete-link" onClick={onComplete}>Finish now</button>}
          </>}
        </div>
        <p className="timer-footnote"><Icon name="lock" size={13} /> Your timer is saved as you go. You can safely close this page.</p>
      </section>

      <aside className="focus-side-column">
        {mode === "pomodoro" ? <div className="surface-card cycle-card">
          <div className="card-heading"><div><span className="section-overline">A STEADY RHYTHM</span><h3>Your Pomodoro flow</h3></div><div className="cycle-mark"><Icon name="timer" size={18} /></div></div>
          <p className="side-card-copy">Work in focused intervals, then give your mind a moment to reset.</p>
          <div className="cycle-dots">{Array.from({ length: pomodoro.sessionsBeforeLongBreak }, (_, index) => <span key={index} className={index < (cycleNumber - 1) % pomodoro.sessionsBeforeLongBreak ? "done" : index === cycleNumber - 1 ? "current" : ""}>{index < (cycleNumber - 1) % pomodoro.sessionsBeforeLongBreak ? <Icon name="check" size={12} /> : index + 1}</span>)}</div>
          <div className="pomodoro-steps"><div><span className="step-dot focus-step" /><span>Focus</span><strong>{pomodoro.focusDuration} min</strong></div><div><span className="step-dot short-step" /><span>Short break</span><strong>{pomodoro.shortBreakDuration} min</strong></div><div><span className="step-dot long-step" /><span>Long break</span><strong>{pomodoro.longBreakDuration} min</strong></div></div>
          <div className="soft-note"><Icon name="spark" size={15} /><span>After {pomodoro.sessionsBeforeLongBreak} focus rounds, take a longer pause.</span></div>
        </div> : <div className="surface-card intention-card">
          <div className="intention-decoration"><div className="intention-orbit" /><div className="intention-leaf"><Icon name="leaf" size={22} /></div></div>
          <span className="section-overline">A SMALL REMINDER</span><h3>Start where<br />you are.</h3><p>You don’t need the perfect plan. Just a little space to begin.</p>
          <span className="intention-foot">BREATHE IN · BREATHE OUT</span>
        </div>}
        <div className="surface-card strict-card">
          <div className="strict-head"><div className="strict-lock"><Icon name="shield" size={17} /></div><div><h3>Strict mode</h3><span>Make leaving less tempting</span></div><button role="switch" aria-checked={settings.strictModeEnabled} aria-label="Toggle strict mode" className={`switch ${settings.strictModeEnabled ? "on" : ""}`} onClick={onToggleStrict}><span /></button></div>
          <p>{settings.strictModeEnabled ? "New sessions will carry a gentle commitment reminder." : "Adds a clear pause before you end a session early."}</p>
          <button className="strict-link" onClick={onGoGuard}>About focus guard <Icon name="arrow" size={13} /></button>
        </div>
        <div className="focus-privacy"><Icon name="lock" size={14} /><span>Timer based on saved timestamps, not a background tick.</span></div>
      </aside>
    </div>
    <div className="focus-bottom-note"><Icon name="info" size={15} /><span>On this web version, the timer keeps accurate time when you return. Browser notifications need permission and may pause during device sleep. Android background services require a native app build.</span></div>
    {confirmStrictExit && <div className="confirm-overlay"><div className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="strict-exit-title"><div className="confirm-icon"><Icon name="shield" size={20} /></div><span className="section-overline">STRICT MODE IS ON</span><h3 id="strict-exit-title">Take a moment before you leave.</h3><p>You chose to protect this focus block. You can keep going, or end it now—your time is yours to choose.</p><div className="confirm-actions"><button className="button button-accent" onClick={() => setConfirmStrictExit(false)}>Keep focusing</button><button className="button button-outline" onClick={() => { setConfirmStrictExit(false); endActiveSession(); }}>{activeSession?.sessionType === "stopwatch" ? "Stop & save" : "End session"}</button></div></div></div>}
  </>;
}

function AnalyticsPage(props: {
  sessions: Session[]; weekDays: ChartDay[]; weekSeconds: number; monthSeconds: number; todaySeconds: number; avgSessionSeconds: number;
  streak: number; goalMinutes: number; range: 7 | 30; setRange: (range: 7 | 30) => void;
}) {
  const { sessions, weekDays, weekSeconds, monthSeconds, todaySeconds, avgSessionSeconds, streak, goalMinutes, range, setRange } = props;
  const goalPercent = Math.min(100, Math.round(todaySeconds / Math.max(1, goalMinutes * 60) * 100));
  const chartDays = range === 7 ? weekDays : Array.from({ length: 30 }, (_, index) => {
    const date = dayStart(index - 29);
    const key = localDayKey(date);
    return { date, key, label: String(date.getDate()), seconds: sessions.filter((session) => localDayKey(session.startedAt) === key).reduce((sum, session) => sum + session.elapsedSeconds, 0) };
  });
  const chartMax = Math.max(...chartDays.map((day) => day.seconds), 60);
  const dayTotals = new Map<string, number>();
  sessions.forEach((session) => {
    const date = new Date(session.startedAt);
    const key = new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    dayTotals.set(key, (dayTotals.get(key) ?? 0) + session.elapsedSeconds);
  });
  const bestDay = [...dayTotals.entries()].sort((a, b) => b[1] - a[1])[0];
  return <>
    <div className="page-heading analytics-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> SMALL STEPS, VISIBLE PROGRESS</div><h1>Your focus, unfolding.</h1><p className="page-subtitle">A clear picture of the time you made for what matters.</p></div>
      <div className="analytics-period"><Icon name="calendar" size={15} /><span>{formatDate(dayStart(-6), { month: "short", day: "numeric" })} – {formatDate(new Date(), { month: "short", day: "numeric" })}</span></div>
    </div>
    <section className="analytics-metrics">
      <div className="metric-card"><span className="section-overline">TODAY</span><strong>{formatMinutes(todaySeconds)}</strong><span><Icon name="clock" size={14} /> Focus time</span><div className="metric-progress"><div style={{ width: `${goalPercent}%` }} /></div><small>{goalPercent}% of your {formatMinutes(goalMinutes * 60)} goal</small></div>
      <div className="metric-card"><span className="section-overline">THIS WEEK</span><strong>{formatMinutes(weekSeconds)}</strong><span><Icon name="chart" size={14} /> Total focus</span><div className="metric-decoration weekly-decoration"><Icon name="spark" size={40} /></div><small>{sessions.filter((session) => new Date(session.startedAt).getTime() >= dayStart(-6).getTime()).length} completed sessions</small></div>
      <div className="metric-card"><span className="section-overline">THIS MONTH</span><strong>{formatMinutes(monthSeconds)}</strong><span><Icon name="calendar" size={14} /> Time set aside</span><div className="metric-decoration month-decoration"><Icon name="leaf" size={40} /></div><small>Made up of completed focus time</small></div>
      <div className="metric-card"><span className="section-overline">YOUR RHYTHM</span><strong>{streak}<small> day{streak === 1 ? "" : "s"}</small></strong><span><Icon name="flame" size={14} /> Current streak</span><div className="metric-decoration streak-decoration">✦</div><small>{avgSessionSeconds ? `Avg. ${formatMinutes(avgSessionSeconds)} per session` : "Your first day can be today"}</small></div>
    </section>
    <section className="surface-card analytics-chart-card">
      <div className="card-heading"><div><span className="section-overline">YOUR TIME, YOUR WAY</span><h3>Focus history</h3></div><div className="range-switch"><button className={range === 7 ? "active" : ""} onClick={() => setRange(7)}>7 days</button><button className={range === 30 ? "active" : ""} onClick={() => setRange(30)}>30 days</button></div></div>
      {sessions.length === 0 ? <div className="chart-empty"><div className="empty-orbit"><Icon name="chart" size={20} /></div><strong>Your focus story starts with a session.</strong><span>Complete a focus block and the chart will grow here.</span></div> : <div className={`analytics-bars ${range === 30 ? "monthly-bars" : ""}`}>
        {chartDays.map((day, index) => <div className={`analytics-bar-column ${index === chartDays.length - 1 ? "is-today" : ""}`} key={day.key} title={`${day.label}: ${formatMinutes(day.seconds)}`}><div className="analytics-bar-space"><div className="analytics-bar-fill" style={{ height: `${day.seconds ? Math.max(3, day.seconds / chartMax * 100) : 2}%` }} /></div><span>{range === 7 ? day.label.slice(0, 1) : (index % 5 === 0 || index === chartDays.length - 1 ? day.label : "")}</span></div>)}
      </div>}
      <div className="analytics-chart-legend"><span><i /> Focus minutes</span><span>DAILY GOAL · {formatMinutes(goalMinutes * 60)}</span></div>
    </section>
    <section className="insight-grid">
      <div className="surface-card insight-card productive-card"><div className="insight-icon"><Icon name="spark" size={18} /></div><span className="section-overline">YOUR MOST PRODUCTIVE DAY</span><strong>{bestDay?.[0] ?? "Still unfolding"}</strong><p>{bestDay ? `${formatMinutes(bestDay[1])} of completed focus time in your history.` : "Your patterns will become clear after a few sessions."}</p></div>
      <div className="surface-card insight-card consistency-card"><div className="insight-icon peach"><Icon name="target" size={18} /></div><span className="section-overline">CONSISTENCY IS THE WIN</span><strong>{sessions.length ? `${sessions.length} sessions` : "Begin gently"}</strong><p>{sessions.length ? "Every saved session is proof you made a little room for yourself." : "No perfect streak needed. Just one mindful block at a time."}</p></div>
    </section>
    <section className="surface-card history-card"><div className="card-heading"><div><span className="section-overline">THE DETAILS</span><h3>Session history</h3></div><span className="history-count">{sessions.length} saved</span></div>{sessions.length ? <div className="session-list">{sessions.slice(0, 12).map((session) => <SessionRow key={session.id} session={session} />)}</div> : <div className="empty-state compact-empty"><div><strong>No sessions just yet</strong><p>Completed focus sessions will appear here.</p></div></div>}</section>
  </>;
}

function FocusGuardPage(props: {
  apps: BlockedApp[]; websites: WebsiteRule[]; appSearch: string; setAppSearch: (value: string) => void;
  onToggleApp: (app: typeof APP_CATALOG[number]) => void; domainInput: string; setDomainInput: (value: string) => void;
  domainError: string; onAddWebsite: (event: React.FormEvent<HTMLFormElement>) => void; onRemoveWebsite: (id: number) => void; onGoFocus: () => void;
}) {
  const { apps, websites, appSearch, setAppSearch, onToggleApp, domainInput, setDomainInput, domainError, onAddWebsite, onRemoveWebsite, onGoFocus } = props;
  const filteredApps = APP_CATALOG.filter((app) => app.appName.toLowerCase().includes(appSearch.toLowerCase()));
  const selectedCount = apps.filter((app) => app.isEnabled).length;
  return <>
    <div className="page-heading guard-heading">
      <div><div className="eyebrow"><span className="eyebrow-dot" /> PROTECT YOUR ATTENTION</div><h1>Build a softer boundary.</h1><p className="page-subtitle">Make a list of the things you want to step away from while you focus.</p></div>
      <div className="guard-count"><span className="guard-count-icon"><Icon name="shield" size={16} /></span><strong>{selectedCount + websites.length}</strong><span>items on your list</span></div>
    </div>
    <div className="capability-notice"><div className="notice-symbol"><Icon name="info" size={18} /></div><div><strong>Important: this browser cannot block Android apps or network traffic.</strong><p>These lists are saved to your FocusMate workspace, but they are planning lists only. Reliable app blocking on Android needs a separately built AccessibilityService; website filtering needs an explicitly enabled local VPN. Neither native service is part of this web project, so no apps or sites are currently being intercepted.</p></div><span className="notice-label">WEB VERSION</span></div>
    <div className="guard-page-grid">
      <section className="surface-card app-picker-card">
        <div className="card-heading"><div><span className="section-overline">DISTRACTION APPS</span><h3>Apps to step away from</h3></div><span className="selection-count">{selectedCount} selected</span></div>
        <p className="section-description">Select popular apps to add to your personal list. Android installed-app discovery is not available in a browser.</p>
        <label className="search-field"><Icon name="search" size={17} /><input value={appSearch} onChange={(event) => setAppSearch(event.target.value)} placeholder="Find an app" aria-label="Search apps" /></label>
        <div className="app-options">{filteredApps.map((app) => {
          const selected = apps.some((saved) => saved.packageName === app.packageName && saved.isEnabled);
          return <button className={`app-option ${selected ? "selected" : ""}`} key={app.packageName} onClick={() => onToggleApp(app)} aria-pressed={selected}>
            <span className="app-brand-icon" style={{ "--app-color": app.color } as React.CSSProperties}>{app.mark}</span><span className="app-option-copy"><strong>{app.appName}</strong><small>{app.packageName}</small></span><span className={`selection-check ${selected ? "checked" : ""}`}>{selected && <Icon name="check" size={13} />}</span>
          </button>;
        })}{filteredApps.length === 0 && <div className="small-empty">No apps match “{appSearch}”.</div>}</div>
        <div className="native-permission-note"><Icon name="lock" size={15} /><span>App access permissions are not requested here. This browser does not need or receive app-usage data.</span></div>
      </section>

      <div className="guard-right-column">
        <section className="surface-card website-card">
          <div className="card-heading"><div><span className="section-overline">WEBSITE IDEAS</span><h3>Sites to set aside</h3></div><div className="website-icon"><Icon name="link" size={17} /></div></div>
          <p className="section-description">Add distracting domains to your planning list. Actual filtering requires the Android VPN companion.</p>
          <form className="domain-form" onSubmit={onAddWebsite}><div className="domain-input-wrap"><Icon name="link" size={16} /><input value={domainInput} onChange={(event) => setDomainInput(event.target.value)} placeholder="e.g. youtube.com" aria-label="Website domain" /><button type="submit" aria-label="Add website"><Icon name="plus" size={17} /></button></div>{domainError && <span className="field-error">{domainError}</span>}</form>
          {websites.length ? <div className="domain-list">{websites.map((rule) => <div className="domain-row" key={rule.id}><span className="domain-favicon"><Icon name="external" size={14} /></span><span>{rule.domain}</span><span className="saved-tag">SAVED</span><button aria-label={`Remove ${rule.domain}`} onClick={() => onRemoveWebsite(rule.id)}><Icon name="close" size={15} /></button></div>)}</div> : <div className="domain-empty"><Icon name="wind" size={18} /><span>Your list is clear. Add a domain above.</span></div>}
          <div className="vpn-explainer"><span className="vpn-explainer-icon"><Icon name="lock" size={14} /></span><span>VPN filtering is not active here. HTTPS content is never inspected by this app.</span></div>
        </section>
        <section className="surface-card strict-explainer"><div className="strict-explainer-mark"><Icon name="shield" size={20} /></div><div><span className="section-overline">A GENTLE COMMITMENT</span><h3>Strict mode</h3><p>On this web version, Strict mode records your choice and adds a reminder. It cannot prevent closing a browser tab or opening another app.</p><button className="text-button" onClick={onGoFocus}>See timer options <Icon name="arrow" size={14} /></button></div></section>
      </div>
    </div>
  </>;
}

function FriendsPage({ sessions }: { sessions: number }) {
  return <>
    <div className="page-heading friends-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> A LITTLE COMPANY GOES A LONG WAY</div><h1>Focus, together.</h1><p className="page-subtitle">Make room for good work, with your favorite people nearby.</p></div><div className="privacy-pill"><span className="status-dot" /> Your data stays private</div></div>
    <div className="friends-hero surface-card"><div className="friends-art"><div className="friend-orbit orbit-f1" /><div className="friend-orbit orbit-f2" /><div className="friend-person person-one">J</div><div className="friend-person person-two">✦</div><div className="friend-person person-three">●</div><span className="friends-star star-one">✳</span><span className="friends-star star-two">✦</span></div><div className="friends-copy"><span className="section-overline">YOUR STUDY CIRCLE</span><h2>Good focus<br />is better shared.</h2><p>Private focus groups, invitation codes, and friendly weekly goals are planned as an optional next step. Your sessions stay local to this workspace for now.</p><div className="friends-coming"><span className="coming-dot" /> PRIVATE GROUPS · LATER PHASE</div></div></div>
    <div className="friends-feature-grid"><div className="surface-card friend-feature"><div className="feature-round"><Icon name="users" size={18} /></div><span className="section-overline">A QUIET ROOM</span><h3>Show up together</h3><p>Start a shared focus block with a small private group.</p><span className="feature-unavailable">Not connected</span></div><div className="surface-card friend-feature"><div className="feature-round lavender"><Icon name="chart" size={18} /></div><span className="section-overline">GENTLE MOMENTUM</span><h3>Celebrate progress</h3><p>Share completed sessions and cheer each other on.</p><span className="feature-unavailable">No sync enabled</span></div><div className="surface-card friend-feature"><div className="feature-round peach"><Icon name="target" size={18} /></div><span className="section-overline">YOUR OWN PACE</span><h3>Shared goals</h3><p>Set a daily intention that feels supportive, never competitive.</p><span className="feature-unavailable">Private by default</span></div></div>
    <div className="friends-data-note"><Icon name="lock" size={15} /><span>You’ve completed <strong>{sessions}</strong> focus sessions in this workspace. No session data is shared with anyone.</span></div>
  </>;
}

function SettingsPage(props: {
  settings: Settings; pomodoro: Pomodoro; saving: boolean; notificationPermission: string;
  onSave: (patch: Partial<Settings>, pomodoro?: Pomodoro) => void; onNotifications: () => void; onGoGuard: () => void;
}) {
  const { settings, pomodoro, saving, notificationPermission, onSave, onNotifications, onGoGuard } = props;
  const [goalDraft, setGoalDraft] = useState(settings.dailyGoalMinutes);
  const [pomodoroDraft, setPomodoroDraft] = useState(pomodoro);
  useEffect(() => { setGoalDraft(settings.dailyGoalMinutes); }, [settings.dailyGoalMinutes]);
  useEffect(() => { setPomodoroDraft(pomodoro); }, [pomodoro]);
  const setPomo = (key: keyof Pomodoro, value: number) => setPomodoroDraft((current) => ({ ...current, [key]: value }));
  return <>
    <div className="page-heading settings-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> MAKE YOUR SPACE YOURS</div><h1>A few good defaults.</h1><p className="page-subtitle">Shape a calmer focus routine, one small choice at a time.</p></div><span className="saving-indicator">{saving ? <><span className="loading-spinner small-spinner" /> Saving…</> : <><Icon name="check" size={14} /> Saved to workspace</>}</span></div>
    <div className="settings-layout">
      <div className="settings-main-column">
        <section className="surface-card settings-panel"><div className="settings-panel-head"><div className="settings-panel-icon"><Icon name="sun" size={18} /></div><div><h3>Appearance</h3><p>Pick the mood that feels right. System follows your device.</p></div></div><div className="theme-options" role="radiogroup" aria-label="Theme">
          {([ ["system", "System", "system"], ["light", "Light", "sun"], ["dark", "Dark", "moon"] ] as const).map(([value, label, icon]) => <button key={value} role="radio" aria-checked={settings.theme === value} className={`theme-option ${settings.theme === value ? "selected" : ""}`} onClick={() => onSave({ theme: value })}><span className="theme-preview"><Icon name={icon} size={17} /></span><span>{label}</span>{settings.theme === value && <Icon name="check" className="theme-check" size={15} />}</button>)}
        </div></section>

        <section className="surface-card settings-panel"><div className="settings-panel-head"><div className="settings-panel-icon goal-setting-icon"><Icon name="target" size={18} /></div><div><h3>Daily focus goal</h3><p>A gentle direction, not a deadline. You can change it anytime.</p></div></div><div className="goal-slider-wrap"><div className="goal-slider-header"><span>DAILY INTENTION</span><strong>{goalDraft >= 60 ? `${Math.floor(goalDraft / 60)}h${goalDraft % 60 ? ` ${goalDraft % 60}m` : ""}` : `${goalDraft} min`}</strong></div><input className="goal-range" type="range" min="30" max="480" step="15" value={goalDraft} style={{ "--range-progress": `${((goalDraft - 30) / 450) * 100}%` } as React.CSSProperties} onChange={(event) => setGoalDraft(Number(event.target.value))} onMouseUp={() => onSave({ dailyGoalMinutes: goalDraft })} onTouchEnd={() => onSave({ dailyGoalMinutes: goalDraft })} onKeyUp={() => onSave({ dailyGoalMinutes: goalDraft })} aria-label="Daily focus goal in minutes"/><div className="range-labels"><span>30 min</span><span>4 hours</span><span>8 hours</span></div></div></section>

        <section className="surface-card settings-panel pomodoro-settings"><div className="settings-panel-head"><div className="settings-panel-icon pomo-setting-icon"><Icon name="timer" size={18} /></div><div><h3>Pomodoro rhythm</h3><p>Choose intervals that work for your kind of focus.</p></div></div><div className="pomodoro-fields">
          {[ ["focusDuration", "Focus interval", "min"], ["shortBreakDuration", "Short break", "min"], ["longBreakDuration", "Long break", "min"], ["sessionsBeforeLongBreak", "Focus rounds", "rounds"] ].map(([key, label, unit]) => <label className="pomo-field" key={key}><span>{label}</span><div><input type="number" min={key === "sessionsBeforeLongBreak" ? 2 : 1} max={key === "sessionsBeforeLongBreak" ? 12 : 180} value={pomodoroDraft[key as keyof Pomodoro]} onChange={(event) => setPomo(key as keyof Pomodoro, Number(event.target.value))} /><small>{unit}</small></div></label>)}
        </div><button className="button button-outline save-pomodoro" onClick={() => onSave({}, pomodoroDraft)}>Save Pomodoro settings</button></section>

        <section className="surface-card settings-panel"><div className="settings-panel-head"><div className="settings-panel-icon sound-setting-icon"><Icon name="volume" size={18} /></div><div><h3>Session cues</h3><p>A gentle nudge when a focus block ends.</p></div></div><div className="setting-toggle-row"><div className="setting-toggle-copy"><strong>Completion sound</strong><span>A short, locally generated chime. No audio files or network streaming.</span></div><button role="switch" aria-checked={settings.soundEnabled} aria-label="Toggle completion sound" className={`switch ${settings.soundEnabled ? "on" : ""}`} onClick={() => onSave({ soundEnabled: !settings.soundEnabled })}><span /></button></div><div className="setting-toggle-row"><div className="setting-toggle-copy"><strong>Vibration</strong><span>Uses the browser vibration API where supported.</span></div><button role="switch" aria-checked={settings.vibrationEnabled} aria-label="Toggle vibration" className={`switch ${settings.vibrationEnabled ? "on" : ""}`} onClick={() => onSave({ vibrationEnabled: !settings.vibrationEnabled })}><span /></button></div><div className="setting-toggle-row"><div className="setting-toggle-copy"><strong>Browser notifications</strong><span>{notificationPermission === "granted" ? "Allowed by this browser." : notificationPermission === "denied" ? "Blocked in browser settings." : "Ask when you’re ready; never prompted on launch."}</span></div><button className="text-button notification-action" onClick={onNotifications}>{notificationPermission === "granted" ? "Enabled" : "Enable"}<Icon name="arrow" size={13} /></button></div></section>
      </div>
      <aside className="settings-side-column"><div className="settings-promise surface-card"><div className="promise-art"><div className="promise-circle"><Icon name="leaf" size={28} /></div><span className="promise-star">✳</span></div><span className="section-overline">YOUR SPACE, YOUR RULES</span><h3>Quietly focused.<br />Never watched.</h3><p>FocusMate stores your timer history and preferences in this workspace. It doesn’t read browsing contents or upload app usage.</p><div className="promise-divider" /><div className="promise-row"><Icon name="lock" size={15} /><span>Local-first intent</span><Icon name="check" size={15} /></div><div className="promise-row"><Icon name="shield" size={15} /><span>No hidden monitoring</span><Icon name="check" size={15} /></div></div>
        <div className="settings-capability surface-card"><span className="section-overline">NATIVE ANDROID FEATURES</span><h3>App & site blocking</h3><p>This web version cannot request Android Usage Access, Accessibility, or VPN permissions.</p><button className="text-button" onClick={onGoGuard}>See what’s supported <Icon name="arrow" size={14} /></button></div>
      </aside>
    </div>
  </>;
}
