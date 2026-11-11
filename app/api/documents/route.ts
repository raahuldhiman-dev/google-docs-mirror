import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createDocument, createSchema, listDocuments } from "@/lib/documents";
import { handleError } from "@/lib/errors";
import { readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json(await listDocuments(await getDb(), user.id));
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const input = createSchema.parse(await readJson(req));
    const id = await createDocument(await getDb(), user.id, input);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
