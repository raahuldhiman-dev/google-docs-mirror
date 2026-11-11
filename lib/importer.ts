import { generateJSON } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";
import { marked } from "marked";
import mammoth from "mammoth";
import { HttpError } from "./errors";

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function txtToHtml(text: string) {
  // Blank line = new paragraph; single newlines become line breaks.
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function extensionOf(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

export function titleFromFilename(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Imported document").slice(0, 200);
}

export async function fileToHtml(name: string, data: Buffer): Promise<string> {
  const ext = extensionOf(name);
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new HttpError(400, `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}`);
  }
  try {
    if (ext === ".txt") return txtToHtml(data.toString("utf8"));
    if (ext === ".md") return await marked.parse(data.toString("utf8"), { async: true });
    return (await mammoth.convertToHtml({ buffer: data }, { styleMap: ["u => u"] })).value;
  } catch {
    throw new HttpError(422, "Could not read this file. It may be corrupt or not a valid " + ext + " file.");
  }
}

/** Convert an uploaded file into Tiptap JSON using the same schema as the editor. */
export async function fileToDoc(name: string, data: Buffer) {
  const html = await fileToHtml(name, data);
  const doc = generateJSON(html || "<p></p>", [StarterKit]);
  return { title: titleFromFilename(name), content: doc };
}
