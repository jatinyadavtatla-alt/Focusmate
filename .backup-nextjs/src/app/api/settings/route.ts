import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pomodoroSettings, userSettings } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.insert(userSettings).values({ id: 1 }).onConflictDoNothing();
    await db.insert(pomodoroSettings).values({ id: 1 }).onConflictDoNothing();
    const [settings, pomodoro] = await Promise.all([
      db.select().from(userSettings).where(eq(userSettings.id, 1)).limit(1),
      db.select().from(pomodoroSettings).where(eq(pomodoroSettings.id, 1)).limit(1),
    ]);
    return Response.json({ settings: settings[0], pomodoro: pomodoro[0] });
  } catch (error) {
    console.error("Failed to fetch preferences", error);
    return Response.json({ error: "Unable to load preferences." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return Response.json({ error: "Invalid preferences." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const settingPatch: Partial<typeof userSettings.$inferInsert> = {};

    if (input.theme !== undefined) {
      if (!["system", "light", "dark"].includes(String(input.theme))) return Response.json({ error: "Invalid theme." }, { status: 400 });
      settingPatch.theme = String(input.theme);
    }
    if (input.dailyGoalMinutes !== undefined) {
      const value = Number(input.dailyGoalMinutes);
      if (!Number.isInteger(value) || value < 15 || value > 720) return Response.json({ error: "Daily goal must be between 15 and 720 minutes." }, { status: 400 });
      settingPatch.dailyGoalMinutes = value;
    }
    for (const field of ["soundEnabled", "vibrationEnabled", "strictModeEnabled"] as const) {
      if (input[field] !== undefined) {
        if (typeof input[field] !== "boolean") return Response.json({ error: `Invalid ${field} value.` }, { status: 400 });
        settingPatch[field] = input[field];
      }
    }

    let savedSettings;
    if (Object.keys(settingPatch).length > 0) {
      savedSettings = await db.insert(userSettings)
        .values({ id: 1, ...settingPatch, updatedAt: new Date() })
        .onConflictDoUpdate({ target: userSettings.id, set: { ...settingPatch, updatedAt: new Date() } })
        .returning();
    }

    const pomodoroInput = input.pomodoro;
    let savedPomodoro;
    if (pomodoroInput !== undefined) {
      if (!pomodoroInput || typeof pomodoroInput !== "object") return Response.json({ error: "Invalid Pomodoro settings." }, { status: 400 });
      const values = pomodoroInput as Record<string, unknown>;
      const focusDuration = Number(values.focusDuration);
      const shortBreakDuration = Number(values.shortBreakDuration);
      const longBreakDuration = Number(values.longBreakDuration);
      const sessionsBeforeLongBreak = Number(values.sessionsBeforeLongBreak);
      if (![focusDuration, shortBreakDuration, longBreakDuration].every((n) => Number.isInteger(n) && n >= 1 && n <= 180)) {
        return Response.json({ error: "Pomodoro durations must be between 1 and 180 minutes." }, { status: 400 });
      }
      if (!Number.isInteger(sessionsBeforeLongBreak) || sessionsBeforeLongBreak < 2 || sessionsBeforeLongBreak > 12) {
        return Response.json({ error: "Long break cycles must be between 2 and 12 sessions." }, { status: 400 });
      }
      savedPomodoro = await db.insert(pomodoroSettings)
        .values({ id: 1, focusDuration, shortBreakDuration, longBreakDuration, sessionsBeforeLongBreak, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: pomodoroSettings.id,
          set: { focusDuration, shortBreakDuration, longBreakDuration, sessionsBeforeLongBreak, updatedAt: new Date() },
        })
        .returning();
    }

    const [settingsRows, pomodoroRows] = await Promise.all([
      db.select().from(userSettings).where(eq(userSettings.id, 1)).limit(1),
      db.select().from(pomodoroSettings).where(eq(pomodoroSettings.id, 1)).limit(1),
    ]);
    return Response.json({ settings: savedSettings?.[0] ?? settingsRows[0], pomodoro: savedPomodoro?.[0] ?? pomodoroRows[0] });
  } catch (error) {
    console.error("Failed to update preferences", error);
    return Response.json({ error: "Unable to save preferences." }, { status: 500 });
  }
}
