# Ajaia Docs: a lightweight collaborative document editor

A small full-stack app inspired by Google Docs: create and edit rich-text documents, import files, and share documents with other users.

**Live demo:** _<paste deployed URL>_  |  **Walkthrough video:** see `walkthrough.txt`

## Test accounts (mocked sign-in, no passwords)

| User | Email |
|---|---|
| Alice Johnson | alice@ajaia.test |
| Bob Martinez | bob@ajaia.test |
| Carol Nguyen | carol@ajaia.test |

On the sign-in screen just click a user. Use **Switch user** (or a second browser profile) to see the other side of a share.

### 60-second review path
1. Sign in as **Alice** → **+ New document** → rename it, type, try the toolbar (bold / italic / underline / H1-H3 / bullet / numbered lists). Watch "All changes saved", then refresh: content and formatting are still there.
2. **Share** → enter `bob@ajaia.test` as *View only* (or *Can edit*).
3. **Switch user** → Bob. The doc appears under **Shared with me** with a role badge. Opened as a viewer it is read-only; as an editor it is editable.
4. Back as Alice, **Import file** with a `.txt`, `.md` or `.docx` → a new editable document.

## Features

| Requirement | What's implemented |
|---|---|
| Create / rename / edit / save / reopen | Dashboard create, inline rename; editor with debounced autosave and a visible save state; retry on failure |
| Rich text | Bold, italic, underline, H1-H3 (text-style dropdown), bulleted and numbered lists, undo/redo (Tiptap / ProseMirror), plus working File / Edit / Format menus |
| Export (stretch) | File → Download as Markdown (.md) or plain text (.txt); **Save as PDF** and Print via the browser's print dialog (the document title becomes the PDF filename) |
| Collaboration indicators (stretch) | "Last edit by X · time" in the editor and the documents list; if someone else saves while you have a document open, a banner appears within ~5 s with a Reload button |
| File upload | **`.txt`, `.md`, `.docx`** (max 2 MB) converted into a new editable document. Limits are stated in the UI |
| Sharing | Owner, share by email with **Can edit** / **View only** roles, change or revoke access, "My documents" vs "Shared with me" with badges |
| Persistence | libSQL/SQLite; content stored as structured editor JSON, so formatting survives reloads |
| Quality | zod validation, consistent JSON errors (400/401/403/404/413/422), automated tests, architecture + AI notes |

## Run locally

Requires Node 18.18+ (developed on Node 24).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: access rules, sharing, validation, import, export
npm run build && npm start   # production build
```

No setup is needed: with no env vars the app creates `./data/app.db` (SQLite), the schema, and seed users on first request.

Optional env vars (see `.env.example`):

| Var | Purpose |
|---|---|
| `TURSO_URL`, `TURSO_TOKEN` | Use a hosted Turso (libSQL) database instead of the local file. Used for the deployment |
| `SESSION_SECRET` | Signs the session cookie. Set a random value in production |

## Deployment

Intended deployment: Vercel plus a free Turso database (serverless platforms have no persistent disk, so a hosted DB is required). Steps:

1. `turso db create ajaia-docs` then `turso db show ajaia-docs --url` and `turso db tokens create ajaia-docs`
2. Import the repo in Vercel and set `TURSO_URL`, `TURSO_TOKEN`, `SESSION_SECRET`
3. Deploy. The schema and seed users are created on first request.

## Known limitations

- **Auth is mocked.** The cookie is signed but there are no passwords. Anyone can pick any seeded user. This is deliberate for the exercise.
- **No real-time collaboration.** Saves are last-write-wins and there is no merging; two people editing the same doc at once can overwrite each other. The editor *detects* other people's saves by polling every 5 s (no websockets, so it stays deployable on serverless) and shows a banner, but you must reload to see their changes.
- Import creates a *new* document. It does not append to an existing one and does not keep the original file.
- `.docx` import keeps headings, bold/italic/underline text and lists; tables, images and complex layout are dropped.
- Sharing is by email among seeded users; there are no invitations or user sign-up.

## What I'd build next (2-4 more hours)
1. Real-time collaboration and live presence with Yjs (Tiptap Collaboration) so concurrent edits merge instead of overwriting; this needs a websocket host, which Vercel does not provide.
2. Version history (snapshot per save session, restore).
3. Server-generated PDF export (today it uses the browser's print dialog) and attaching the original uploaded file to a document.
4. Real authentication (e.g. NextAuth with magic links) and share-by-invite for users who don't exist yet.
5. Component and E2E tests (Playwright) for the editor and share dialog.

See `ARCHITECTURE.md`, `AI_WORKFLOW.md` and `SUBMISSION.md`.
