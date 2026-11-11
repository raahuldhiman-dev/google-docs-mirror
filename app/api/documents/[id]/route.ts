import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteDocument, getDocument, updateDocument, updateSchema } from "@/lib/documents";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export async function GET(_: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    return NextResponse.json(await getDocument(await getDb(), user.id, params.id));
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    const patch = updateSchema.parse(await readJson(req));
    return NextResponse.json(await updateDocument(await getDb(), user.id, params.id, patch));
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_: Request, { params }: Ctx) {
  try {
    const user = await requireUser();
    await deleteDocument(await getDb(), user.id, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
