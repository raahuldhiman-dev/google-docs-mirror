import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Deployment self-check: reports which settings exist (never their values) and whether the DB answers.
export async function GET() {
  const config = {
    tursoUrlSet: Boolean(process.env.TURSO_URL),
    tursoTokenSet: Boolean(process.env.TURSO_TOKEN),
    sessionSecretSet: Boolean(process.env.SESSION_SECRET),
    tursoUrlLooksRemote: /^(libsql|https|wss):\/\//.test(process.env.TURSO_URL ?? ""),
  };
  try {
    const db = await getDb();
    const r = await db.execute("SELECT COUNT(*) AS users FROM users");
    return NextResponse.json({ ok: true, users: Number(r.rows[0].users), config });
  } catch (e) {
    console.error("health check failed:", e);
    return NextResponse.json({ ok: false, error: String((e as Error).message).slice(0, 300), config }, { status: 503 });
  }
}
