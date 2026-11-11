import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";
import { HttpError } from "./errors";

// Mocked auth: the user picks a seeded account and gets a signed cookie.
// Signing stops casual tampering; this is NOT production authentication.
export const COOKIE = "ajaia_uid";
const secret = () => process.env.SESSION_SECRET ?? "dev-only-secret-change-me";

const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("hex");

export function makeToken(userId: string) {
  return `${userId}.${sign(userId)}`;
}

export function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const id = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const expected = Buffer.from(sign(id));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  return id;
}

export type User = { id: string; name: string; email: string };

export async function getCurrentUser(): Promise<User | null> {
  const id = readToken(cookies().get(COOKIE)?.value);
  if (!id) return null;
  const db = await getDb();
  const r = await db.execute({ sql: "SELECT id, name, email FROM users WHERE id = ?", args: [id] });
  const row = r.rows[0];
  return row ? { id: String(row.id), name: String(row.name), email: String(row.email) } : null;
}

export async function requireUser(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) throw new HttpError(401, "Not signed in");
  return u;
}
