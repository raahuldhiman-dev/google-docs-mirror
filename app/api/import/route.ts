import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { createDocument } from "@/lib/documents";
import { HttpError, handleError } from "@/lib/errors";
import { MAX_UPLOAD_BYTES, fileToDoc } from "@/lib/importer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new HttpError(400, "Expected a multipart file upload");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "No file provided");
    if (file.size === 0) throw new HttpError(400, "The file is empty");
    if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(413, "File is too large (max 2 MB)");
    const { title, content } = await fileToDoc(file.name, Buffer.from(await file.arrayBuffer()));
    const id = await createDocument(await getDb(), user.id, { title, content });
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
