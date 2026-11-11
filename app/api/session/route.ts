import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE, getCurrentUser, makeToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError, handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ user: await getCurrentUser() });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = z.object({ userId: z.string() }).parse(await readJson(req));
    const db = await getDb();
    const r = await db.execute({ sql: "SELECT id, name, email FROM users WHERE id = ?", args: [userId] });
    if (!r.rows[0]) throw new HttpError(404, "Unknown user");
    const res = NextResponse.json({ user: r.rows[0] });
    res.cookies.set(COOKIE, makeToken(userId), { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" });
    return res;
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
