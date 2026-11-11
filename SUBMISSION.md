# Submission contents

| Item | Location |
|---|---|
| Source code | `app/`, `components/`, `lib/`, `tests/`, `package.json`, config files |
| Setup & run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This manifest | `SUBMISSION.md` |
| Live product URL | https://google-docs-mirror.vercel.app (health check: https://google-docs-mirror.vercel.app/api/health) |
| Walkthrough video link | `walkthrough.txt` |
| Test accounts | alice@ajaia.test, bob@ajaia.test, carol@ajaia.test (click to sign in, no passwords) |
| Screenshots | `screenshots/`: 18 images, indexed below |

## Status
**Stretch goals included:** Editor/Viewer roles; Markdown/text export and Save-as-PDF; collaboration indicators (last edited by, "edited by someone else" banner).

**Working end to end:** create / rename / edit / autosave / reopen; bold, italic, underline, H1-H3, bullet and numbered lists; `.txt` / `.md` / `.docx` import into a new document; sharing with Can edit / View only roles, change and revoke; owned vs shared listing with badges; persistence across refresh; validation and error handling; 15 automated tests.

**Incomplete / deliberately out of scope:** real authentication, true real-time collaboration (changes by others are detected and flagged within ~5 s, but not merged; last-write-wins), version history, comments, server-side PDF (the PDF option uses the browser print dialog), attaching original uploads.

**Next with 2-4 more hours:** Yjs real-time collaboration and presence, version history, PDF export, real auth, Playwright E2E tests.

## Screenshot index (`screenshots/`)
Captured from the running app at 1280×800 (mobile at 390×844) using the seeded accounts.

| File | Shows |
|---|---|
| `01-login.png` | Mocked sign-in with the three seeded users |
| `02-home-initial.png` | Documents home as Alice: template row, filters, seeded welcome document |
| `03-editor-formatting.png` | Editor with H1/H2/H3, bold, italic, underline, bulleted and numbered lists; "All changes saved" |
| `04-file-menu.png` | File menu: New, Rename, Markdown/text download, Save as PDF, Print |
| `05-format-menu.png` | Format menu with the text styles and list actions |
| `06-share-dialog.png` | Sharing: Bob can edit, Carol view only, change or remove access |
| `07-import-markdown.png` | `.md` file imported into a new editable document |
| `08-import-docx.png` | `.docx` file imported (heading, bold and underline preserved) |
| `09-import-error.png` | Validation error for an unsupported file type (`.pdf`) |
| `10-home-documents.png` | Documents list after the imports (owner badges, last modified by) |
| `11-home-row-menu.png` | Row actions: Rename / Remove (owner only) |
| `12-home-search.png` | Search filtering the list |
| `13-shared-with-me.png` | Bob's "Shared with me" view with the "Can edit" badge and owner name |
| `14-shared-as-editor.png` | Bob editing a shared document (banner explains his access) |
| `15-shared-as-viewer-readonly.png` | Carol's view-only access: no toolbar, read-only body |
| `16-edited-by-other-user-banner.png` | Alice is told Bob edited the document she has open |
| `17-mobile-home.png` | Home at phone width |
| `18-mobile-editor.png` | Editor at phone width |

