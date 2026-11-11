import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { removeShare } from "@/lib/documents";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(_: Request, { params }: { params: { id: string; userId: string } }) {
  try {
    const user = await requireUser();
    await removeShare(await getDb(), user.id, params.id, params.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
