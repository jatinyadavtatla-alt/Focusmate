import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blockedApps, focusSessions, pomodoroSettings, userSettings, websiteRules } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.insert(userSettings).values({ id: 1 }).onConflictDoNothing();
    await db.insert(pomodoroSettings).values({ id: 1 }).onConflictDoNothing();

    const [settingsRows, pomodoroRows, sessions, apps, websites] = await Promise.all([
      db.select().from(userSettings).where(eq(userSettings.id, 1)).limit(1),
      db.select().from(pomodoroSettings).where(eq(pomodoroSettings.id, 1)).limit(1),
      db.select().from(focusSessions).orderBy(desc(focusSessions.startedAt)).limit(120),
      db.select().from(blockedApps).orderBy(blockedApps.appName),
      db.select().from(websiteRules).orderBy(websiteRules.domain),
    ]);

    return Response.json({
      settings: settingsRows[0] ?? null,
      pomodoro: pomodoroRows[0] ?? null,
      sessions,
      blockedApps: apps,
      websiteRules: websites,
    });
  } catch (error) {
    console.error("Failed to load FocusMate state", error);
    return Response.json({ error: "Unable to load FocusMate data." }, { status: 500 });
  }
}
