import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getMeta } from "@/lib/documents";
import { handleError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    return NextResponse.json(await getMeta(await getDb(), user.id, params.id));
  } catch (e) {
    return handleError(e);
  }
}
