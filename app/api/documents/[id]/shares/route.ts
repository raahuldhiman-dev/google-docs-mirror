import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addShare, listShares, shareSchema } from "@/lib/documents";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export async function GET(_: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    return NextResponse.json({ shares: await listShares(await getDb(), user.id, params.id) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { email, role } = shareSchema.parse(await readJson(req));
    const db = await getDb();
    await addShare(db, user.id, params.id, email, role);
    return NextResponse.json({ shares: await listShares(db, user.id, params.id) });
  } catch (e) {
    return handleError(e);
  }
}
