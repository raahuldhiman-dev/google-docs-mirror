# Architecture note

## Goal and priorities
Ship the strongest *working* slice of a Google Docs-style editor in the timebox. I put depth into the four things reviewers will actually exercise (editing, sharing, persistence, import) and cut everything else on purpose.

1. **Correct access control** over polish. Sharing is the part most likely to be subtly wrong, so it lives in one place and is tested.
2. **A solid editing loop** (autosave, visible state, retry) over a long feature list.
3. **A deployable, free, zero-config stack** so reviewers can run or open it in minutes.

## Stack and why
| Choice | Reason |
|---|---|
| Next.js 14 (App Router) + TypeScript | One repo and one deploy for UI and API; route handlers keep the backend small |
| Tiptap (ProseMirror) | Real rich-text engine with bold/italic/underline/headings/lists out of the box. Building on `contenteditable` directly would burn the timebox |
| libSQL (`@libsql/client`) | The same code runs on a local SQLite file for dev and on free hosted Turso in production. Plain SQLite on Vercel would lose data (ephemeral disk) |
| zod | Request validation in one declarative place |
| Vitest | Fast tests against an in-memory libSQL database, no mocks of the DB |

## Data model
```
users(id, name, email UNIQUE)
documents(id, owner_id → users, title, content_json, created_at, updated_at)
shares(document_id → documents, user_id → users, role 'editor'|'viewer', PK(document_id, user_id))
```
Content is stored as **Tiptap/ProseMirror JSON**, not HTML. That preserves document structure exactly, and the same schema is used when importing files, so imported and hand-written documents are identical.

## Module layout
```
lib/db.ts         schema, seed, shared client (one per process)
lib/access.ts     pure role rules (resolveRole, canEdit, canManage)
lib/documents.ts  all document/share operations + zod schemas; takes a db client (testable)
lib/importer.ts   .txt/.md/.docx → HTML → editor JSON
lib/auth.ts       mocked auth: HMAC-signed httpOnly cookie
app/api/**        thin route handlers: auth → validate → call lib → map errors
components/       Login, Dashboard, Editor (+Toolbar), ShareDialog
```
Route handlers contain no business logic; every permission decision goes through `lib/documents.ts`, which makes the access matrix testable without HTTP.

## Access model
- Role is `owner` (document creator), `editor` or `viewer` (via `shares`), otherwise none.
- Read: any role. Edit/rename: owner, editor. Delete and manage sharing: owner only.
- A user with **no** access gets **404**, not 403, so document ids can't be probed. A user with *some* access who lacks the permission gets 403 with a clear message.
- Enforcement is server-side on every route. The UI hiding buttons is only a convenience.

## Editing and saving
- Editor changes are debounced (800 ms) into a single `PATCH` carrying only the changed fields (title and/or content).
- Pending edits are kept in refs so the debounced saver always sends the latest state; edits made *during* an in-flight save trigger another save rather than being lost.
- On failure the changes are re-queued and surfaced with a **Retry** button; a `beforeunload` handler does a best-effort `keepalive` save.
- Viewers get a read-only editor with no toolbar and a banner explaining why.

## Detecting other people's edits
Every save records `updated_by`. An open editor polls a tiny `GET /api/documents/:id/meta` endpoint every 5 s (paused while the tab is hidden). It compares `updatedAt` with the newest value this tab has seen (loaded or saved by itself) and, if someone *else* saved, shows a banner with a Reload button. Polling was chosen over websockets or SSE because serverless hosting can't hold long-lived connections, and the cost is one small query per open editor per 5 s. It signals conflicts but does not resolve them. Existing databases get the `updated_by` column added automatically on startup.

## File import
`.txt` (paragraphs), `.md` (via `marked`), `.docx` (via `mammoth`) → HTML → `generateJSON` with the *same* Tiptap extensions as the editor, so anything that can't be represented is dropped by the schema rather than corrupting the document. Guards: extension allow-list, 2 MB cap, empty-file check, and corrupt files return a friendly 422.

## Deliberate cuts and trade-offs
| Cut | Trade-off accepted |
|---|---|
| Real auth | Seeded users + signed cookie. Clearly labelled mocked; lets reviewers test sharing in seconds |
| Real-time collaboration | Last-write-wins, with polling-based *detection* of others' edits. Proper CRDT sync (Yjs) is the next step, and it needs a websocket host |
| Storing uploaded originals | Import converts and discards the file, so no blob storage dependency |
| Version history, comments, server-side PDF | Optional stretch. I added Markdown/text export (a pure, tested function), PDF via the browser print dialog, and edit-detection indicators instead |
| E2E test suite | I tested the UI flows with a scripted browser run during development, but the committed automated tests cover the server logic where bugs are most costly |

## Testing
`npm test` runs 16 tests against an in-memory database: role resolution, the owner/editor/viewer/none permission matrix, 404-vs-403 behaviour, owned-vs-shared listings, share upsert/revoke/self-share/unknown-email, cascade on delete, content round-trip, schema validation and import conversion (md, txt, unsupported, corrupt), Markdown/plain-text export, real `.docx` import, last-edited tracking, the in-place schema migration and a concurrent cold-start race.
