import type { Client } from "@libsql/client";
import { z } from "zod";
import { canEdit, canManage, resolveRole, type Role } from "./access";
import { EMPTY_DOC } from "./db";
import { HttpError } from "./errors";

export const MAX_CONTENT_BYTES = 1_000_000;

export const titleSchema = z.string().trim().min(1, "Title is required").max(200, "Title is too long");

// Tiptap/ProseMirror JSON: we only insist on the root shape; the editor schema does the rest.
export const contentSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.any()).optional() })
  .passthrough()
  .refine((c) => JSON.stringify(c).length <= MAX_CONTENT_BYTES, "Document is too large");

export const createSchema = z.object({ title: titleSchema.optional(), content: contentSchema.optional() });
export const updateSchema = z
  .object({ title: titleSchema.optional(), content: contentSchema.optional() })
  .refine((v) => v.title !== undefined || v.content !== undefined, "Nothing to update");
export const shareSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["editor", "viewer"]),
});

export type DocSummary = {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  role: Role;
  updatedAt: number;
  updatedById: string;
  updatedByName: string;
};
export type DocFull = DocSummary & { content: unknown };

const newId = () => "d_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export async function getRole(db: Client, docId: string, userId: string): Promise<{ role: Role | null; exists: boolean }> {
  const r = await db.execute({
    sql: `SELECT d.owner_id, s.role AS share_role FROM documents d
          LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ?
          WHERE d.id = ?`,
    args: [userId, docId],
  });
  const row = r.rows[0];
  if (!row) return { role: null, exists: false };
  return {
    exists: true,
    role: resolveRole(String(row.owner_id), userId, (row.share_role as "editor" | "viewer" | null) ?? null),
  };
}

// Unauthorised and missing both look like 404 so document ids can't be probed.
async function need(db: Client, docId: string, userId: string, check: (r: Role | null) => boolean, deniedMsg: string) {
  const { role } = await getRole(db, docId, userId);
  if (role === null) throw new HttpError(404, "Document not found");
  if (!check(role)) throw new HttpError(403, deniedMsg);
  return role;
}

const toSummary = (row: Record<string, unknown>, role: Role): DocSummary => ({
  id: String(row.id),
  title: String(row.title),
  ownerId: String(row.owner_id),
  ownerName: String(row.owner_name),
  role,
  updatedAt: Number(row.updated_at),
  updatedById: String(row.updated_by ?? row.owner_id),
  updatedByName: String(row.updated_by_name ?? row.owner_name),
});

export async function listDocuments(db: Client, userId: string) {
  const owned = await db.execute({
    sql: `SELECT d.id, d.title, d.owner_id, d.updated_at, d.updated_by, u.name AS owner_name, eu.name AS updated_by_name
          FROM documents d JOIN users u ON u.id = d.owner_id LEFT JOIN users eu ON eu.id = d.updated_by
          WHERE d.owner_id = ? ORDER BY d.updated_at DESC`,
    args: [userId],
  });
  const shared = await db.execute({
    sql: `SELECT d.id, d.title, d.owner_id, d.updated_at, d.updated_by, u.name AS owner_name, eu.name AS updated_by_name, s.role AS share_role
          FROM shares s JOIN documents d ON d.id = s.document_id JOIN users u ON u.id = d.owner_id
          LEFT JOIN users eu ON eu.id = d.updated_by
          WHERE s.user_id = ? ORDER BY d.updated_at DESC`,
    args: [userId],
  });
  return {
    owned: owned.rows.map((r) => toSummary(r, "owner")),
    shared: shared.rows.map((r) => toSummary(r, r.share_role as Role)),
  };
}

export async function createDocument(
  db: Client,
  userId: string,
  input: { title?: string; content?: unknown },
): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.execute({
    sql: "INSERT INTO documents (id, owner_id, title, content_json, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [id, userId, input.title ?? "Untitled document", input.content ? JSON.stringify(input.content) : EMPTY_DOC, now, now, userId],
  });
  return id;
}

export async function getDocument(db: Client, userId: string, docId: string): Promise<DocFull> {
  const role = await need(db, docId, userId, () => true, "");
  const r = await db.execute({
    sql: `SELECT d.*, u.name AS owner_name, eu.name AS updated_by_name FROM documents d
          JOIN users u ON u.id = d.owner_id LEFT JOIN users eu ON eu.id = d.updated_by WHERE d.id = ?`,
    args: [docId],
  });
  const row = r.rows[0];
  return { ...toSummary(row, role!), content: JSON.parse(String(row.content_json)) };
}

export async function updateDocument(
  db: Client,
  userId: string,
  docId: string,
  patch: { title?: string; content?: unknown },
) {
  await need(db, docId, userId, canEdit, "You have view-only access to this document");
  const sets: string[] = ["updated_at = ?", "updated_by = ?"];
  const args: (string | number)[] = [Date.now(), userId];
  if (patch.title !== undefined) {
    sets.push("title = ?");
    args.push(patch.title);
  }
  if (patch.content !== undefined) {
    sets.push("content_json = ?");
    args.push(JSON.stringify(patch.content));
  }
  await db.execute({ sql: `UPDATE documents SET ${sets.join(", ")} WHERE id = ?`, args: [...args, docId] });
  return { updatedAt: args[0] as number };
}

/** Cheap change-detection for the editor's "edited by someone else" banner (no content payload). */
export async function getMeta(db: Client, userId: string, docId: string) {
  await need(db, docId, userId, () => true, "");
  const r = await db.execute({
    sql: `SELECT d.updated_at, d.updated_by, eu.name AS updated_by_name FROM documents d
          LEFT JOIN users eu ON eu.id = d.updated_by WHERE d.id = ?`,
    args: [docId],
  });
  const row = r.rows[0];
  return { updatedAt: Number(row.updated_at), updatedById: String(row.updated_by), updatedByName: String(row.updated_by_name) };
}

export async function deleteDocument(db: Client, userId: string, docId: string) {
  await need(db, docId, userId, canManage, "Only the owner can delete this document");
  await db.execute({ sql: "DELETE FROM shares WHERE document_id = ?", args: [docId] });
  await db.execute({ sql: "DELETE FROM documents WHERE id = ?", args: [docId] });
}

export async function listShares(db: Client, userId: string, docId: string) {
  await need(db, docId, userId, canManage, "Only the owner can manage sharing");
  const r = await db.execute({
    sql: `SELECT u.id, u.name, u.email, s.role FROM shares s JOIN users u ON u.id = s.user_id
          WHERE s.document_id = ? ORDER BY u.name`,
    args: [docId],
  });
  return r.rows.map((x) => ({ userId: String(x.id), name: String(x.name), email: String(x.email), role: x.role as "editor" | "viewer" }));
}

export async function addShare(db: Client, userId: string, docId: string, email: string, role: "editor" | "viewer") {
  await need(db, docId, userId, canManage, "Only the owner can manage sharing");
  const u = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
  if (!u.rows[0]) throw new HttpError(404, "No user with that email");
  const targetId = String(u.rows[0].id);
  if (targetId === userId) throw new HttpError(400, "You already own this document");
  // Upsert: re-sharing just changes the role.
  await db.execute({
    sql: `INSERT INTO shares (document_id, user_id, role) VALUES (?, ?, ?)
          ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role`,
    args: [docId, targetId, role],
  });
}

export async function removeShare(db: Client, userId: string, docId: string, targetUserId: string) {
  await need(db, docId, userId, canManage, "Only the owner can manage sharing");
  await db.execute({ sql: "DELETE FROM shares WHERE document_id = ? AND user_id = ?", args: [docId, targetUserId] });
}
