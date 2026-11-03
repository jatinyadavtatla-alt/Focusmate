import { eq } from "drizzle-orm";
import { db } from "@/db";
import { focusSessions } from "@/db/schema";

export const dynamic = "force-dynamic";

type SessionAction = "pause" | "resume" | "finish" | "cancel";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body: unknown = await request.json();
    const action = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
    if (typeof action !== "string" || !["pause", "resume", "finish", "cancel"].includes(action)) {
      return Response.json({ error: "Choose a valid session action." }, { status: 400 });
    }

    const matches = await db.select().from(focusSessions).where(eq(focusSessions.id, id)).limit(1);
    const session = matches[0];
    if (!session) return Response.json({ error: "Session not found." }, { status: 404 });
    if (session.status !== "active" && session.status !== "paused") {
      return Response.json({ error: "This session is already closed." }, { status: 409 });
    }

    const now = new Date();
    const segmentSeconds = session.status === "active" && session.segmentStartedAt
      ? Math.max(0, Math.floor((now.getTime() - session.segmentStartedAt.getTime()) / 1000))
      : 0;
    const elapsedSeconds = session.elapsedSeconds + segmentSeconds;
    let values: Partial<typeof focusSessions.$inferInsert>;

    if (action === "pause") {
      if (session.status !== "active") return Response.json({ error: "Only a running session can be paused." }, { status: 409 });
      values = { elapsedSeconds, status: "paused", segmentStartedAt: null };
    } else if (action === "resume") {
      if (session.status !== "paused") return Response.json({ error: "Only a paused session can be resumed." }, { status: 409 });
      values = { status: "active", segmentStartedAt: now };
    } else if (action === "finish") {
      values = { elapsedSeconds, status: "completed", completed: true, endedAt: now, segmentStartedAt: null };
    } else {
      values = { elapsedSeconds, status: "cancelled", completed: false, endedAt: now, segmentStartedAt: null };
    }

    const updated = await db.update(focusSessions).set(values).where(eq(focusSessions.id, id)).returning();
    return Response.json({ session: updated[0] });
  } catch (error) {
    console.error("Failed to update focus session", error);
    return Response.json({ error: "Unable to update this session." }, { status: 500 });
  }
}
