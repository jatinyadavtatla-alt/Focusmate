import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { websiteRules } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ rules: await db.select().from(websiteRules).orderBy(asc(websiteRules.domain)) });
  } catch (error) {
    console.error("Failed to load website rules", error);
    return Response.json({ error: "Unable to load website rules." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const rawDomain = body && typeof body === "object" ? (body as Record<string, unknown>).domain : null;
    if (typeof rawDomain !== "string") return Response.json({ error: "Enter a valid domain." }, { status: 400 });
    const candidate = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!/^(?:\*\.)?[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(candidate)) {
      return Response.json({ error: "Enter a domain such as youtube.com." }, { status: 400 });
    }
    const rows = await db.insert(websiteRules).values({ domain: candidate, isEnabled: true }).onConflictDoNothing().returning();
    if (rows[0]) return Response.json({ rule: rows[0] }, { status: 201 });
    const existing = await db.select().from(websiteRules).where(eq(websiteRules.domain, candidate)).limit(1);
    return Response.json({ rule: existing[0] });
  } catch (error) {
    console.error("Failed to save website rule", error);
    return Response.json({ error: "Unable to save this domain." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Choose a valid rule." }, { status: 400 });
    await db.delete(websiteRules).where(eq(websiteRules.id, id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to delete website rule", error);
    return Response.json({ error: "Unable to remove this domain." }, { status: 500 });
  }
}
