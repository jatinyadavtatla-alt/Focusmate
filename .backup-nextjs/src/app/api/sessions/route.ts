import { desc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { focusSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

const sessionTypes = new Set(["focus", "custom", "stopwatch", "pomodoro_focus", "short_break", "long_break"]);

export async function GET() {
  try {
    const sessions = await db.select().from(focusSessions).orderBy(desc(focusSessions.startedAt)).limit(120);
    return Response.json({ sessions });
  } catch (error) {
    console.error("Failed to fetch focus sessions", error);
    return Response.json({ error: "Unable to load sessions." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return Response.json({ error: "Invalid session details." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const sessionType = typeof input.sessionType === "string" ? input.sessionType : "focus";
    const planned = input.plannedDurationSeconds;
    const plannedDurationSeconds = planned === null || planned === undefined ? null : Number(planned);

    if (!sessionTypes.has(sessionType)) {
      return Response.json({ error: "Unsupported session type." }, { status: 400 });
    }
    if (plannedDurationSeconds !== null && (!Number.isInteger(plannedDurationSeconds) || plannedDurationSeconds < 60 || plannedDurationSeconds > 86_400)) {
      return Response.json({ error: "Choose a duration between one minute and 24 hours." }, { status: 400 });
    }

    const current = await db
      .select()
      .from(focusSessions)
      .where(inArray(focusSessions.status, ["active", "paused"]))
      .orderBy(desc(focusSessions.startedAt))
      .limit(1);
    if (current[0]) {
      return Response.json({ error: "A focus session is already in progress.", session: current[0] }, { status: 409 });
    }

    const now = new Date();
    const rows = await db
      .insert(focusSessions)
      .values({
        startedAt: now,
        segmentStartedAt: now,
        elapsedSeconds: 0,
        plannedDurationSeconds,
        sessionType,
        status: "active",
        strictMode: input.strictMode === true,
      })
      .returning();
    return Response.json({ session: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Failed to start focus session", error);
    return Response.json({ error: "Unable to start the session." }, { status: 500 });
  }
}
