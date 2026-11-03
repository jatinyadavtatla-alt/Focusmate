import { asc } from "drizzle-orm";
import { db } from "@/db";
import { blockedApps } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const apps = await db.select().from(blockedApps).orderBy(asc(blockedApps.appName));
    return Response.json({ apps });
  } catch (error) {
    console.error("Failed to fetch app list", error);
    return Response.json({ error: "Unable to load your app list." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    const apps = body && typeof body === "object" ? (body as Record<string, unknown>).apps : null;
    if (!Array.isArray(apps) || apps.length > 100) {
      return Response.json({ error: "Provide up to 100 selected applications." }, { status: 400 });
    }
    const normalized = apps.map((entry) => {
      if (!entry || typeof entry !== "object") throw new Error("Invalid app selection.");
      const app = entry as Record<string, unknown>;
      const packageName = typeof app.packageName === "string" ? app.packageName.trim() : "";
      const appName = typeof app.appName === "string" ? app.appName.trim() : "";
      if (!/^[a-zA-Z0-9._-]{2,220}$/.test(packageName) || !appName || appName.length > 80) throw new Error("Invalid app selection.");
      return { packageName, appName, isEnabled: app.isEnabled !== false };
    });
    const unique = [...new Map(normalized.map((app) => [app.packageName, app])).values()];

    await db.transaction(async (tx) => {
      await tx.delete(blockedApps);
      if (unique.length > 0) await tx.insert(blockedApps).values(unique);
    });
    return Response.json({ apps: unique });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid app selection.") return Response.json({ error: error.message }, { status: 400 });
    console.error("Failed to save app selection", error);
    return Response.json({ error: "Unable to save your app list." }, { status: 500 });
  }
}
