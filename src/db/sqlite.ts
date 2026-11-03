import * as SQLite from "expo-sqlite";

export type SessionStatus = "active" | "paused" | "completed" | "cancelled";

export type Session = {
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
  createdAt: string;
};

export type Settings = {
  theme: "system" | "light" | "dark";
  dailyGoalMinutes: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  strictModeEnabled: boolean;
};

export type Pomodoro = {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
};

export type BlockedApp = {
  packageName: string;
  appName: string;
  isEnabled: boolean;
};

export type WebsiteRule = {
  id: number;
  domain: string;
  isEnabled: boolean;
  createdAt: string;
};

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("focusmate.db");
    await initDb(dbInstance);
  }
  return dbInstance;
}

async function initDb(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'dark',
      daily_goal_minutes INTEGER NOT NULL DEFAULT 180,
      sound_enabled INTEGER NOT NULL DEFAULT 0,
      vibration_enabled INTEGER NOT NULL DEFAULT 1,
      strict_mode_enabled INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pomodoro_settings (
      id INTEGER PRIMARY KEY,
      focus_duration INTEGER NOT NULL DEFAULT 25,
      short_break_duration INTEGER NOT NULL DEFAULT 5,
      long_break_duration INTEGER NOT NULL DEFAULT 15,
      sessions_before_long_break INTEGER NOT NULL DEFAULT 4,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS focus_sessions (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      segment_started_at TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      planned_duration_seconds INTEGER,
      session_type TEXT NOT NULL DEFAULT 'focus',
      status TEXT NOT NULL DEFAULT 'active',
      completed INTEGER NOT NULL DEFAULT 0,
      strict_mode INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocked_apps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_name TEXT NOT NULL UNIQUE,
      app_name TEXT NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started ON focus_sessions (started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON focus_sessions (status);

    CREATE TABLE IF NOT EXISTS website_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      domain TEXT NOT NULL UNIQUE,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  // Ensure default user_settings row
  const userRow = await db.getFirstAsync("SELECT id FROM user_settings WHERE id = 1");
  if (!userRow) {
    await db.runAsync(
      `INSERT INTO user_settings (id, theme, daily_goal_minutes, sound_enabled, vibration_enabled, strict_mode_enabled, updated_at)
       VALUES (1, 'dark', 180, 0, 1, 0, ?)`,
      new Date().toISOString()
    );
  }

  // Ensure default pomodoro_settings row
  const pomoRow = await db.getFirstAsync("SELECT id FROM pomodoro_settings WHERE id = 1");
  if (!pomoRow) {
    await db.runAsync(
      `INSERT INTO pomodoro_settings (id, focus_duration, short_break_duration, long_break_duration, sessions_before_long_break, updated_at)
       VALUES (1, 25, 5, 15, 4, ?)`,
      new Date().toISOString()
    );
  }

  // Ensure default popular blocked apps if table is empty
  const appCount = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) as count FROM blocked_apps");
  if (!appCount || appCount.count === 0) {
    const defaults = [
      { packageName: "com.instagram.android", appName: "Instagram" },
      { packageName: "com.google.android.youtube", appName: "YouTube" },
      { packageName: "com.zhiliaoapp.musically", appName: "TikTok" },
      { packageName: "com.reddit.frontpage", appName: "Reddit" },
      { packageName: "com.twitter.android", appName: "X" },
      { packageName: "com.facebook.katana", appName: "Facebook" },
    ];
    for (const app of defaults) {
      await db.runAsync(
        "INSERT OR IGNORE INTO blocked_apps (package_name, app_name, is_enabled) VALUES (?, ?, 1)",
        app.packageName,
        app.appName
      );
    }
  }
}

export async function fetchAllState() {
  const db = await getDb();

  const settingsRow = await db.getFirstAsync<any>("SELECT * FROM user_settings WHERE id = 1");
  const pomoRow = await db.getFirstAsync<any>("SELECT * FROM pomodoro_settings WHERE id = 1");
  const sessionRows = await db.getAllAsync<any>(
    `SELECT * FROM focus_sessions
     WHERE datetime(started_at) >= datetime('now', '-90 days') OR status IN ('active', 'paused')
     ORDER BY datetime(started_at) DESC`
  );
  const appRows = await db.getAllAsync<any>("SELECT * FROM blocked_apps ORDER BY app_name ASC");
  const siteRows = await db.getAllAsync<any>("SELECT * FROM website_rules ORDER BY domain ASC");

  const settings: Settings = {
    theme: (settingsRow?.theme as any) || "dark",
    dailyGoalMinutes: settingsRow?.daily_goal_minutes ?? 180,
    soundEnabled: Boolean(settingsRow?.sound_enabled),
    vibrationEnabled: Boolean(settingsRow?.vibration_enabled ?? 1),
    strictModeEnabled: Boolean(settingsRow?.strict_mode_enabled),
  };

  const pomodoro: Pomodoro = {
    focusDuration: pomoRow?.focus_duration ?? 25,
    shortBreakDuration: pomoRow?.short_break_duration ?? 5,
    longBreakDuration: pomoRow?.long_break_duration ?? 15,
    sessionsBeforeLongBreak: pomoRow?.sessions_before_long_break ?? 4,
  };

  const sessions: Session[] = sessionRows.map(rowToSession);

  const blockedApps: BlockedApp[] = appRows.map((row) => ({
    packageName: row.package_name,
    appName: row.app_name,
    isEnabled: Boolean(row.is_enabled),
  }));

  const websiteRules: WebsiteRule[] = siteRows.map((row) => ({
    id: row.id,
    domain: row.domain,
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at,
  }));

  return { settings, pomodoro, sessions, blockedApps, websiteRules };
}

export async function createSession(
  plannedDurationSeconds: number | null,
  sessionType: string,
  strictMode: boolean,
  startAt: Date = new Date()
): Promise<Session> {
  const db = await getDb();
  const id = `session_${startAt.getTime()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = startAt.toISOString();

  await db.runAsync(
    `INSERT INTO focus_sessions (
      id, started_at, ended_at, segment_started_at, duration_seconds,
      planned_duration_seconds, session_type, status, completed, strict_mode, created_at
    ) VALUES (?, ?, NULL, ?, 0, ?, ?, 'active', 0, ?, ?)`,
    id,
    now,
    now,
    plannedDurationSeconds,
    sessionType,
    strictMode ? 1 : 0,
    now
  );

  return {
    id,
    startedAt: now,
    endedAt: null,
    segmentStartedAt: now,
    elapsedSeconds: 0,
    plannedDurationSeconds,
    sessionType,
    status: "active",
    completed: false,
    strictMode,
    createdAt: now,
  };
}

export async function mutateSession(
  id: string,
  action: "pause" | "resume" | "finish" | "cancel",
  nowMs: number = Date.now()
): Promise<Session | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>("SELECT * FROM focus_sessions WHERE id = ?", id);
  if (!row) return null;

  const now = new Date(nowMs);
  const segTime = row.segment_started_at ? new Date(row.segment_started_at).getTime() : 0;
  const currentSegment = row.status === "active" && segTime > 0
    ? Math.max(0, Math.floor((now.getTime() - segTime) / 1000))
    : 0;
  const newElapsed = row.duration_seconds + currentSegment;

  let newStatus: SessionStatus = row.status;
  let newCompleted = row.completed;
  let newEndedAt = row.ended_at;
  let newSegment: string | null = null;

  if (action === "pause") {
    newStatus = "paused";
    newSegment = null;
  } else if (action === "resume") {
    newStatus = "active";
    newSegment = now.toISOString();
  } else if (action === "finish") {
    newStatus = "completed";
    newCompleted = 1;
    newEndedAt = now.toISOString();
    newSegment = null;
  } else if (action === "cancel") {
    newStatus = "cancelled";
    newCompleted = 0;
    newEndedAt = now.toISOString();
    newSegment = null;
  }

  await db.runAsync(
    `UPDATE focus_sessions SET
      duration_seconds = ?,
      status = ?,
      completed = ?,
      ended_at = ?,
      segment_started_at = ?
     WHERE id = ?`,
    newElapsed,
    newStatus,
    newCompleted,
    newEndedAt,
    newSegment,
    id
  );

  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: newEndedAt,
    segmentStartedAt: newSegment,
    elapsedSeconds: newElapsed,
    plannedDurationSeconds: row.planned_duration_seconds,
    sessionType: row.session_type,
    status: newStatus,
    completed: Boolean(newCompleted),
    strictMode: Boolean(row.strict_mode),
    createdAt: row.created_at,
  };
}

export async function updateUserSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  if (patch.theme !== undefined) {
    await db.runAsync("UPDATE user_settings SET theme = ?, updated_at = ? WHERE id = 1", patch.theme, now);
  }
  if (patch.dailyGoalMinutes !== undefined) {
    await db.runAsync("UPDATE user_settings SET daily_goal_minutes = ?, updated_at = ? WHERE id = 1", patch.dailyGoalMinutes, now);
  }
  if (patch.soundEnabled !== undefined) {
    await db.runAsync("UPDATE user_settings SET sound_enabled = ?, updated_at = ? WHERE id = 1", patch.soundEnabled ? 1 : 0, now);
  }
  if (patch.vibrationEnabled !== undefined) {
    await db.runAsync("UPDATE user_settings SET vibration_enabled = ?, updated_at = ? WHERE id = 1", patch.vibrationEnabled ? 1 : 0, now);
  }
  if (patch.strictModeEnabled !== undefined) {
    await db.runAsync("UPDATE user_settings SET strict_mode_enabled = ?, updated_at = ? WHERE id = 1", patch.strictModeEnabled ? 1 : 0, now);
  }
}

export async function updatePomodoroSettings(patch: Partial<Pomodoro>): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  if (patch.focusDuration !== undefined) {
    await db.runAsync("UPDATE pomodoro_settings SET focus_duration = ?, updated_at = ? WHERE id = 1", patch.focusDuration, now);
  }
  if (patch.shortBreakDuration !== undefined) {
    await db.runAsync("UPDATE pomodoro_settings SET short_break_duration = ?, updated_at = ? WHERE id = 1", patch.shortBreakDuration, now);
  }
  if (patch.longBreakDuration !== undefined) {
    await db.runAsync("UPDATE pomodoro_settings SET long_break_duration = ?, updated_at = ? WHERE id = 1", patch.longBreakDuration, now);
  }
  if (patch.sessionsBeforeLongBreak !== undefined) {
    await db.runAsync("UPDATE pomodoro_settings SET sessions_before_long_break = ?, updated_at = ? WHERE id = 1", patch.sessionsBeforeLongBreak, now);
  }
}

export async function setBlockedApps(apps: BlockedApp[]): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM blocked_apps");
    for (const app of apps) {
      await db.runAsync(
        "INSERT INTO blocked_apps (package_name, app_name, is_enabled) VALUES (?, ?, ?)",
        app.packageName,
        app.appName,
        app.isEnabled ? 1 : 0
      );
    }
  });
}

export async function addWebsite(domain: string): Promise<WebsiteRule> {
  const db = await getDb();
  const now = new Date().toISOString();
  const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");

  await db.runAsync(
    "INSERT OR IGNORE INTO website_rules (domain, is_enabled, created_at) VALUES (?, 1, ?)",
    cleanDomain,
    now
  );

  const row = await db.getFirstAsync<any>("SELECT * FROM website_rules WHERE domain = ?", cleanDomain);
  return {
    id: row.id,
    domain: row.domain,
    isEnabled: Boolean(row.is_enabled),
    createdAt: row.created_at,
  };
}

export async function deleteWebsite(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM website_rules WHERE id = ?", id);
}


// ---------------------------------------------------------------------------
// Additions for the focus engine, analytics, guard and settings screens
// ---------------------------------------------------------------------------

export function rowToSession(row: any): Session {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    segmentStartedAt: row.segment_started_at,
    elapsedSeconds: row.duration_seconds,
    plannedDurationSeconds: row.planned_duration_seconds,
    sessionType: row.session_type,
    status: row.status as SessionStatus,
    completed: Boolean(row.completed),
    strictMode: Boolean(row.strict_mode),
    createdAt: row.created_at,
  };
}

export async function getAppState(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM app_state WHERE key = ?", key);
  return row ? row.value : null;
}

export async function setAppState(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    "INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value
  );
}

export async function getPomodoroSettings(): Promise<Pomodoro> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>("SELECT * FROM pomodoro_settings WHERE id = 1");
  return {
    focusDuration: row?.focus_duration ?? 25,
    shortBreakDuration: row?.short_break_duration ?? 5,
    longBreakDuration: row?.long_break_duration ?? 15,
    sessionsBeforeLongBreak: row?.sessions_before_long_break ?? 4,
  };
}

/** The single running/paused session, if any. Extra stale rows are closed out as cancelled. */
export async function getActiveSession(): Promise<Session | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM focus_sessions WHERE status IN ('active', 'paused') ORDER BY datetime(started_at) DESC"
  );
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    const now = new Date().toISOString();
    for (const stale of rows.slice(1)) {
      await db.runAsync(
        "UPDATE focus_sessions SET status = 'cancelled', completed = 0, ended_at = ?, segment_started_at = NULL WHERE id = ?",
        now,
        stale.id
      );
    }
  }
  return rowToSession(rows[0]);
}

export async function finalizeSession(
  id: string,
  result: { status: "completed" | "cancelled"; elapsedSeconds: number; endedAt: Date }
): Promise<Session | null> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE focus_sessions SET
       duration_seconds = ?, status = ?, completed = ?, ended_at = ?, segment_started_at = NULL
     WHERE id = ?`,
    Math.max(0, Math.round(result.elapsedSeconds)),
    result.status,
    result.status === "completed" ? 1 : 0,
    result.endedAt.toISOString(),
    id
  );
  const row = await db.getFirstAsync<any>("SELECT * FROM focus_sessions WHERE id = ?", id);
  return row ? rowToSession(row) : null;
}

export async function discardSession(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM focus_sessions WHERE id = ?", id);
}

export async function clearSessionHistory(): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM focus_sessions WHERE status NOT IN ('active', 'paused')");
}

export async function upsertBlockedApp(app: BlockedApp): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO blocked_apps (package_name, app_name, is_enabled) VALUES (?, ?, ?)
     ON CONFLICT(package_name) DO UPDATE SET app_name = excluded.app_name, is_enabled = excluded.is_enabled`,
    app.packageName,
    app.appName,
    app.isEnabled ? 1 : 0
  );
}

export async function removeBlockedApp(packageName: string): Promise<void> {
  const db = await getDb();
  await db.runAsync("DELETE FROM blocked_apps WHERE package_name = ?", packageName);
}
