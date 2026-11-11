import { beforeEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { initDb, newClient } from "../lib/db";
import { resolveRole } from "../lib/access";
import {
  addShare,
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  listShares,
  removeShare,
  updateDocument,
  updateSchema,
} from "../lib/documents";
import { HttpError } from "../lib/errors";

const ALICE = "u_alice";
const BOB = "u_bob";
const CAROL = "u_carol";

let db: Client;
beforeEach(async () => {
  db = newClient(":memory:");
  await initDb(db);
});

const status = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof HttpError) return e.status;
    throw e;
  }
};

describe("resolveRole", () => {
  it("owner beats share, share beats nothing", () => {
    expect(resolveRole("a", "a", "viewer")).toBe("owner");
    expect(resolveRole("a", "b", "editor")).toBe("editor");
    expect(resolveRole("a", "b", null)).toBeNull();
  });
});

describe("documents & sharing", () => {
  it("persists content and title round-trip", async () => {
    const id = await createDocument(db, ALICE, { title: "Plan" });
    const content = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi" }] }] };
    await updateDocument(db, ALICE, id, { title: "Plan v2", content });
    const doc = await getDocument(db, ALICE, id);
    expect(doc.title).toBe("Plan v2");
    expect(doc.content).toEqual(content);
    expect(doc.role).toBe("owner");
  });

  it("hides documents from users without access (404, not 403)", async () => {
    const id = await createDocument(db, ALICE, {});
    expect(await status(getDocument(db, BOB, id))).toBe(404);
    expect(await status(updateDocument(db, BOB, id, { title: "x" }))).toBe(404);
  });

  it("viewer can read but not edit or delete; editor can edit but not delete or share", async () => {
    const id = await createDocument(db, ALICE, { title: "Shared" });
    await addShare(db, ALICE, id, "bob@ajaia.test", "viewer");
    await addShare(db, ALICE, id, "carol@ajaia.test", "editor");

    expect((await getDocument(db, BOB, id)).role).toBe("viewer");
    expect(await status(updateDocument(db, BOB, id, { title: "hack" }))).toBe(403);
    expect(await status(updateDocument(db, CAROL, id, { title: "ok" }))).toBe(200);
    expect(await status(deleteDocument(db, CAROL, id))).toBe(403);
    expect(await status(addShare(db, CAROL, id, "bob@ajaia.test", "editor"))).toBe(403);
    expect(await status(listShares(db, BOB, id))).toBe(403);
  });

  it("separates owned from shared in listings", async () => {
    const id = await createDocument(db, ALICE, { title: "Mine" });
    await addShare(db, ALICE, id, "bob@ajaia.test", "editor");
    const alice = await listDocuments(db, ALICE);
    const bob = await listDocuments(db, BOB);
    expect(alice.owned.map((d) => d.id)).toContain(id);
    expect(alice.shared).toHaveLength(0);
    expect(bob.owned).toHaveLength(0);
    expect(bob.shared).toMatchObject([{ id, role: "editor", ownerName: "Alice Johnson" }]);
  });

  it("re-sharing updates the role; revoke removes access; self-share and unknown email rejected", async () => {
    const id = await createDocument(db, ALICE, {});
    await addShare(db, ALICE, id, "bob@ajaia.test", "viewer");
    await addShare(db, ALICE, id, "bob@ajaia.test", "editor");
    expect(await listShares(db, ALICE, id)).toMatchObject([{ userId: BOB, role: "editor" }]);
    await removeShare(db, ALICE, id, BOB);
    expect(await status(getDocument(db, BOB, id))).toBe(404);
    expect(await status(addShare(db, ALICE, id, "alice@ajaia.test", "viewer"))).toBe(400);
    expect(await status(addShare(db, ALICE, id, "nobody@x.test", "viewer"))).toBe(404);
  });

  it("deleting a document removes its shares", async () => {
    const id = await createDocument(db, ALICE, {});
    await addShare(db, ALICE, id, "bob@ajaia.test", "viewer");
    await deleteDocument(db, ALICE, id);
    expect((await listDocuments(db, BOB)).shared).toHaveLength(0);
  });
});

describe("validation", () => {
  it("rejects empty updates, blank titles and non-doc content", () => {
    expect(updateSchema.safeParse({}).success).toBe(false);
    expect(updateSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(updateSchema.safeParse({ content: { type: "paragraph" } }).success).toBe(false);
    expect(updateSchema.safeParse({ title: "Ok", content: { type: "doc", content: [] } }).success).toBe(true);
  });
});

import { fileToDoc } from "../lib/importer";

describe("import", () => {
  it("turns markdown into structured editor JSON", async () => {
    const { title, content } = await fileToDoc("meeting_notes.md", Buffer.from("# Agenda\n\n- one\n- two\n\n**bold** text"));
    expect(title).toBe("meeting notes");
    const types = (content.content as { type: string }[]).map((n) => n.type);
    expect(types).toEqual(["heading", "bulletList", "paragraph"]);
    expect(JSON.stringify(content)).toContain('"type":"bold"');
  });

  it("turns plain text into paragraphs and rejects unsupported/corrupt files", async () => {
    const { content } = await fileToDoc("a.txt", Buffer.from("first\n\nsecond"));
    expect((content.content as unknown[]).length).toBe(2);
    await expect(fileToDoc("a.pdf", Buffer.from("x"))).rejects.toMatchObject({ status: 400 });
    await expect(fileToDoc("bad.docx", Buffer.from("not a zip"))).rejects.toMatchObject({ status: 422 });
  });
});

import { docToMarkdown, docToText, safeFilename } from "../lib/export";

describe("export", () => {
  const doc = {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Plan" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", marks: [{ type: "bold" }], text: "Bold" },
          { type: "text", text: " and " },
          { type: "text", marks: [{ type: "italic" }, { type: "underline" }], text: "both" },
        ],
      },
      {
        type: "orderedList",
        attrs: { start: 1 },
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "one" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "two" }] }] },
        ],
      },
    ],
  };

  it("serialises headings, marks and lists to Markdown", () => {
    expect(docToMarkdown(doc)).toBe("## Plan\n\n**Bold** and <u>_both_</u>\n\n1. one\n2. two\n");
  });
  it("serialises to plain text and sanitises filenames", () => {
    expect(docToText(doc)).toBe("Plan\n\nBold and both\n\n1. one\n2. two\n");
    expect(safeFilename('a/b:c*"?.md', "md")).toBe("abc.md.md");
    expect(safeFilename("   ", "txt")).toBe("document.txt");
  });
});

import JSZip from "jszip";

describe("docx import", () => {
  async function makeDocx(body: string) {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`,
    );
    return zip.generateAsync({ type: "nodebuffer" });
  }

  it("imports a real .docx with bold and underline runs", async () => {
    const buf = await makeDocx(
      `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Bold start</w:t></w:r><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t xml:space="preserve"> underlined</w:t></w:r></w:p><w:p><w:r><w:t>Second paragraph</w:t></w:r></w:p>`,
    );
    const { title, content } = await fileToDoc("Project_Brief.docx", buf);
    expect(title).toBe("Project Brief");
    const json = JSON.stringify(content);
    expect(json).toContain("Bold start");
    expect(json).toContain("Second paragraph");
    expect(json).toContain('"type":"bold"');
    expect(json).toContain('"type":"underline"');
    expect((content.content as unknown[]).length).toBe(2);
  });
});

import { getMeta } from "../lib/documents";

describe("last edited tracking", () => {
  it("records who last edited and exposes it via meta and listings", async () => {
    const id = await createDocument(db, ALICE, { title: "Tracked" });
    await addShare(db, ALICE, id, "bob@ajaia.test", "editor");
    expect((await getMeta(db, BOB, id)).updatedById).toBe(ALICE);
    await new Promise((r) => setTimeout(r, 5));
    await updateDocument(db, BOB, id, { title: "Tracked v2" });
    const meta = await getMeta(db, ALICE, id);
    expect(meta).toMatchObject({ updatedById: BOB, updatedByName: "Bob Martinez" });
    expect((await listDocuments(db, ALICE)).owned[0]).toMatchObject({ updatedById: BOB, updatedByName: "Bob Martinez" });
    expect(await status(getMeta(db, CAROL, id))).toBe(404);
  });
});

describe("schema migration", () => {
  it("adds updated_by to a database created before the column existed", async () => {
    const old = newClient(":memory:");
    await old.execute("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE)");
    await old.execute(
      "CREATE TABLE documents (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL, content_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)",
    );
    await old.execute("INSERT INTO users VALUES ('u_alice','Alice Johnson','alice@ajaia.test')");
    await old.execute("INSERT INTO documents VALUES ('d_old','u_alice','Old','{\"type\":\"doc\"}',1,1)");
    await initDb(old);
    const r = await old.execute("SELECT updated_by FROM documents WHERE id='d_old'");
    expect(r.rows[0].updated_by).toBe("u_alice");
    expect((await getMeta(old, "u_alice", "d_old")).updatedByName).toBe("Alice Johnson");
  });
});
