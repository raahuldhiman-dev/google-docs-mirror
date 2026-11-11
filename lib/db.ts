import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "fs";
import { dirname } from "path";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    content_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS shares (
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    PRIMARY KEY (document_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id)`,
  `CREATE INDEX IF NOT EXISTS idx_shares_user ON shares(user_id)`,
];

export const SEED_USERS = [
  { id: "u_alice", name: "Alice Johnson", email: "alice@ajaia.test" },
  { id: "u_bob", name: "Bob Martinez", email: "bob@ajaia.test" },
  { id: "u_carol", name: "Carol Nguyen", email: "carol@ajaia.test" },
];

const EMPTY_DOC = JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });

export function welcomeContent() {
  return JSON.stringify({
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Welcome to Ajaia Docs" }] },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "This is a " },
          { type: "text", marks: [{ type: "bold" }], text: "bold" },
          { type: "text", text: ", " },
          { type: "text", marks: [{ type: "italic" }], text: "italic" },
          { type: "text", text: " and " },
          { type: "text", marks: [{ type: "underline" }], text: "underlined" },
          { type: "text", text: " sample document. Share it with Bob to try collaboration." },
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Rich-text formatting" }] }] },
          { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Import .txt / .md / .docx" }] }] },
        ],
      },
    ],
  });
}

export function newClient(url?: string, authToken?: string): Client {
  const target = url || process.env.TURSO_URL || "file:data/app.db";
  // A fresh clone has no data/ folder; create it so the local SQLite file can be opened.
  if (target.startsWith("file:") && !target.includes(":memory:")) {
    mkdirSync(dirname(target.slice("file:".length)), { recursive: true });
  }
  return createClient({ url: target, authToken: authToken || undefined });
}

export async function initDb(client: Client) {
  for (const stmt of SCHEMA) await client.execute(stmt);
  // Databases created before "last edited by" existed need the column added in place.
  const cols = await client.execute("PRAGMA table_info(documents)");
  if (!cols.rows.some((c) => c.name === "updated_by")) {
    await client.execute("ALTER TABLE documents ADD COLUMN updated_by TEXT REFERENCES users(id)");
    await client.execute("UPDATE documents SET updated_by = owner_id WHERE updated_by IS NULL");
  }
  for (const u of SEED_USERS) {
    await client.execute({
      sql: "INSERT OR IGNORE INTO users (id, name, email) VALUES (?, ?, ?)",
      args: [u.id, u.name, u.email],
    });
  }
  const existing = await client.execute("SELECT COUNT(*) AS n FROM documents");
  if (Number(existing.rows[0].n) === 0) {
    const now = Date.now();
    await client.execute({
      sql: "INSERT INTO documents (id, owner_id, title, content_json, created_at, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: ["d_welcome", "u_alice", "Welcome to Ajaia Docs", welcomeContent(), now, now, "u_alice"],
    });
  }
}

export { EMPTY_DOC };

// Single shared client per server process; schema is created once on first use.
// The cache key includes the schema text so a hot-reloaded dev server re-runs initDb (and its
// migrations) after the schema changes, instead of reusing a connection initialised by old code.
const KEY = `__db_${SCHEMA.join("").length}`;
const g = globalThis as unknown as Record<string, Promise<Client> | undefined>;

export function getDb(): Promise<Client> {
  if (!g[KEY]) {
    g[KEY] = (async () => {
      const c = newClient(process.env.TURSO_URL, process.env.TURSO_TOKEN);
      await initDb(c);
      return c;
    })();
    g[KEY]!.catch(() => {
      g[KEY] = undefined;
    });
  }
  return g[KEY]!;
}
