import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    const r = await db.execute("SELECT id, name, email FROM users ORDER BY name");
    return NextResponse.json({ users: r.rows.map((u) => ({ id: u.id, name: u.name, email: u.email })) });
  } catch (e) {
    return handleError(e);
  }
}
