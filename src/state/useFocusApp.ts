import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, useColorScheme } from "react-native";
import * as db from "../db/sqlite";
import type { BlockedApp, Pomodoro, Session, Settings, WebsiteRule } from "../db/sqlite";
import * as engine from "../engine/focusEngine";
import type { FocusMode, PomodoroRun } from "../engine/focusEngine";
import { normalizeDomain } from "../lib/domain";
import { buildDashboardStats, isBreakType, liveElapsed } from "../lib/stats";
import { NativeFocus, PermissionStatus } from "../native/FocusNativeModule";
import { darkTheme, lightTheme, ThemeColors } from "../theme/colors";

export const DEFAULT_FOCUS_MINUTES = 30;

const defaultSettings: Settings = {
  theme: "dark",
  dailyGoalMinutes: 180,
  soundEnabled: false,
  vibrationEnabled: true,
  strictModeEnabled: false,
};
const defaultPomodoro: Pomodoro = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
};
const noPermissions: PermissionStatus = {
  accessibility: false,
  usageStats: false,
  overlay: false,
  notifications: false,
  batteryOptimization: false,
};

/** Whether the user opted in to website blocking; read by pushSessionToNative. */
let websiteBlockingOn = false;

/** Tell the native layer what is happening so blocking and the ongoing notification match SQLite. */
function pushSessionToNative(s: Session | null, nowMs: number) {
  if (!s) {
    NativeFocus.syncSessionState(false, false, 0, 0, "focus");
    NativeFocus.setWebsiteBlockingActive(false);
    NativeFocus.stopTimerService();
    return;
  }
  const elapsed = liveElapsed(s, nowMs);
  const paused = s.status === "paused";
  // Blocking applies to focus phases only. A paused strict session keeps blocking; a normal pause does not.
  const blocking = !isBreakType(s.sessionType) && (s.status === "active" || s.strictMode);
  NativeFocus.syncSessionState(blocking, s.strictMode, paused ? 0 : s.plannedDurationSeconds ?? 0, elapsed, s.sessionType);
  NativeFocus.setWebsiteBlockingActive(blocking && websiteBlockingOn);
  NativeFocus.startTimerService(s.sessionType, s.plannedDurationSeconds ?? 0, elapsed, paused);
}

export function useFocusApp() {
  const systemScheme = useColorScheme();
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pomodoro, setPomodoro] = useState<Pomodoro>(defaultPomodoro);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [blockedApps, setBlockedApps] = useState<BlockedApp[]>([]);
  const [websiteRules, setWebsiteRules] = useState<WebsiteRule[]>([]);
  const [active, setActive] = useState<Session | null>(null);
  const [run, setRun] = useState<PomodoroRun>({ active: false, completedFocus: 0 });
  const [userName, setUserNameState] = useState("");
  const [lastFocusMinutes, setLastFocusMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [permissions, setPermissions] = useState<PermissionStatus>(noPermissions);
  const [websiteBlocking, setWebsiteBlockingState] = useState(false);
  const [vpnReady, setVpnReady] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  const activeRef = useRef<Session | null>(null);
  activeRef.current = active;

  const notify = useCallback((text: string) => setMessage(text), []);

  const loadAll = useCallback(async () => {
    const state = await db.fetchAllState();
    setSettings(state.settings);
    setPomodoro(state.pomodoro);
    setSessions(state.sessions);
    setBlockedApps(state.blockedApps);
    setWebsiteRules(state.websiteRules);
    setRun(await engine.loadRun());
    return state;
  }, []);

  const refreshPermissions = useCallback(async () => {
    setPermissions(await NativeFocus.checkPermissions());
    setVpnReady(await NativeFocus.isVpnPrepared());
  }, []);

  /** Bring everything in line with the wall clock (used at launch and whenever the app returns to the foreground). */
  const reconcileNow = useCallback(async () => {
    const result = await engine.reconcile();
    setActive(result.active);
    pushSessionToNative(result.active, Date.now());
    await loadAll();
    return result;
  }, [loadAll]);

  // ---- boot -------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const state = await loadAll();
        setUserNameState((await db.getAppState("user_name")) ?? "");
        const saved = Number(await db.getAppState("last_focus_minutes"));
        if (saved > 0) setLastFocusMinutes(saved);
        NativeFocus.syncPreferences(state.settings.soundEnabled, state.settings.vibrationEnabled);
        websiteBlockingOn = (await db.getAppState("website_blocking")) === "1";
        setWebsiteBlockingState(websiteBlockingOn);
        NativeFocus.syncBlockedDomains(state.websiteRules.filter((w) => w.isEnabled).map((w) => w.domain));
        NativeFocus.syncBlockedPackages(state.blockedApps.filter((a) => a.isEnabled).map((a) => a.packageName));
        await reconcileNow();
        await refreshPermissions();
      } catch (e) {
        console.warn("FocusMate boot failed", e);
        notify("Couldn't open your local database. Try restarting the app.");
      } finally {
        setReady(true);
      }
    })();
  }, [loadAll, reconcileNow, refreshPermissions, notify]);

  // ---- foreground / background -----------------------------------------
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        setNowTick(Date.now());
        reconcileNow().catch(() => {});
        refreshPermissions().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [reconcileNow, refreshPermissions]);

  // ---- ticking & automatic phase completion ----------------------------
  const completePhase = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const result = await engine.reconcile();
      if (result.completed.length > 0) {
        NativeFocus.notifyPhaseComplete(result.completed[result.completed.length - 1].sessionType);
      }
      setActive(result.active);
      pushSessionToNative(result.active, Date.now());
      await loadAll();
    } catch (e) {
      console.warn("completePhase failed", e);
    } finally {
      busy.current = false;
    }
  }, [loadAll]);

  useEffect(() => {
    if (!active || active.status !== "active") return;
    const id = setInterval(() => {
      const n = Date.now();
      setNowTick(n);
      const cur = activeRef.current;
      if (cur && cur.status === "active" && cur.plannedDurationSeconds && liveElapsed(cur, n) >= cur.plannedDurationSeconds) {
        completePhase();
      }
    }, 500);
    return () => clearInterval(id);
  }, [active, completePhase]);

  // ---- derived ----------------------------------------------------------
  const activeElapsed = active ? liveElapsed(active, nowTick) : 0;
  const mode = settings.theme === "system" ? systemScheme ?? "dark" : settings.theme;
  const colors: ThemeColors = mode === "dark" ? darkTheme : lightTheme;
  const dashboardStats = useMemo(() => buildDashboardStats(sessions, settings, nowTick), [sessions, settings, nowTick]);

  // ---- actions ----------------------------------------------------------
  const guarded = useCallback(
    async (fn: () => Promise<void>) => {
      try {
        await fn();
      } catch (e) {
        console.warn("action failed", e);
        notify("Something went wrong saving that. Please try again.");
      }
    },
    [notify]
  );

  const startSession = useCallback(
    (focusMode: FocusMode, minutes: number) =>
      guarded(async () => {
        const s = await engine.startMode(focusMode, minutes, settings.strictModeEnabled, pomodoro);
        if (focusMode === "focus") {
          setLastFocusMinutes(minutes);
          await db.setAppState("last_focus_minutes", String(minutes));
        }
        setActive(s);
        setNowTick(Date.now());
        pushSessionToNative(s, Date.now());
        await loadAll();
      }),
    [guarded, settings.strictModeEnabled, pomodoro, loadAll]
  );

  const pauseResume = useCallback(
    () =>
      guarded(async () => {
        const cur = activeRef.current;
        if (!cur) return;
        const next = cur.status === "active" ? await engine.pause(cur) : await engine.resume(cur);
        setActive(next);
        setNowTick(Date.now());
        pushSessionToNative(next, Date.now());
        await loadAll();
      }),
    [guarded, loadAll]
  );

  const endSession = useCallback(
    () =>
      guarded(async () => {
        const cur = activeRef.current;
        if (!cur) return;
        await engine.endByUser(cur);
        setActive(null);
        pushSessionToNative(null, Date.now());
        await loadAll();
      }),
    [guarded, loadAll]
  );

  const skipBreak = useCallback(
    () =>
      guarded(async () => {
        const cur = activeRef.current;
        if (!cur || !isBreakType(cur.sessionType)) return;
        const { next } = await engine.endByUser(cur, { skipBreakToNext: true, pomodoro });
        setActive(next);
        pushSessionToNative(next, Date.now());
        await loadAll();
      }),
    [guarded, pomodoro, loadAll]
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) =>
      guarded(async () => {
        await db.updateUserSettings(patch);
        const next = { ...settings, ...patch };
        setSettings(next);
        if (patch.soundEnabled !== undefined || patch.vibrationEnabled !== undefined) {
          NativeFocus.syncPreferences(next.soundEnabled, next.vibrationEnabled);
        }
      }),
    [guarded, settings]
  );

  const updatePomodoro = useCallback(
    (patch: Partial<Pomodoro>) =>
      guarded(async () => {
        await db.updatePomodoroSettings(patch);
        setPomodoro((p) => ({ ...p, ...patch }));
      }),
    [guarded]
  );

  const setUserName = useCallback(
    (name: string) =>
      guarded(async () => {
        const clean = name.trim().slice(0, 40);
        await db.setAppState("user_name", clean);
        setUserNameState(clean);
      }),
    [guarded]
  );

  const syncBlockedToNative = useCallback((apps: BlockedApp[]) => {
    NativeFocus.syncBlockedPackages(apps.filter((a) => a.isEnabled).map((a) => a.packageName));
  }, []);

  const setAppBlocked = useCallback(
    (packageName: string, appName: string, enabled: boolean) =>
      guarded(async () => {
        await db.upsertBlockedApp({ packageName, appName, isEnabled: enabled });
        const state = await db.fetchAllState();
        setBlockedApps(state.blockedApps);
        syncBlockedToNative(state.blockedApps);
      }),
    [guarded, syncBlockedToNative]
  );

  const removeApp = useCallback(
    (packageName: string) =>
      guarded(async () => {
        await db.removeBlockedApp(packageName);
        const state = await db.fetchAllState();
        setBlockedApps(state.blockedApps);
        syncBlockedToNative(state.blockedApps);
      }),
    [guarded, syncBlockedToNative]
  );

  const addWebsite = useCallback(
    (domain: string) =>
      guarded(async () => {
        const clean = normalizeDomain(domain);
        if (!clean) {
          notify("That doesn't look like a website address, e.g. example.com");
          return;
        }
        await db.addWebsite(clean);
        const rules = (await db.fetchAllState()).websiteRules;
        setWebsiteRules(rules);
        NativeFocus.syncBlockedDomains(rules.filter((w) => w.isEnabled).map((w) => w.domain));
      }),
    [guarded]
  );

  const deleteWebsite = useCallback(
    (id: number) =>
      guarded(async () => {
        await db.deleteWebsite(id);
        const rules = (await db.fetchAllState()).websiteRules;
        setWebsiteRules(rules);
        NativeFocus.syncBlockedDomains(rules.filter((w) => w.isEnabled).map((w) => w.domain));
      }),
    [guarded]
  );

  const setWebsiteBlocking = useCallback(
    (enabled: boolean) =>
      guarded(async () => {
        websiteBlockingOn = enabled;
        setWebsiteBlockingState(enabled);
        await db.setAppState("website_blocking", enabled ? "1" : "0");
        if (enabled && !(await NativeFocus.isVpnPrepared())) NativeFocus.requestVpnPermission();
        pushSessionToNative(activeRef.current, Date.now()); // apply immediately if a block is running
      }),
    [guarded]
  );

  const clearHistory = useCallback(
    () =>
      guarded(async () => {
        await db.clearSessionHistory();
        await loadAll();
      }),
    [guarded, loadAll]
  );

  return {
    ready,
    colors,
    isDark: mode === "dark",
    settings,
    pomodoro,
    sessions,
    blockedApps,
    websiteRules,
    active,
    activeElapsed,
    run,
    userName,
    lastFocusMinutes,
    permissions,
    websiteBlocking,
    vpnReady,
    setWebsiteBlocking,
    nowTick,
    message,
    clearMessage: () => setMessage(null),
    dashboardStats,
    refresh: reconcileNow,
    refreshPermissions,
    startSession,
    pauseResume,
    endSession,
    skipBreak,
    updateSettings,
    updatePomodoro,
    setUserName,
    setAppBlocked,
    removeApp,
    addWebsite,
    deleteWebsite,
    clearHistory,
  };
}

export type FocusApp = ReturnType<typeof useFocusApp>;
