# Submission contents

| Item | Location |
|---|---|
| Source code | `app/`, `components/`, `lib/`, `tests/`, `package.json`, config files |
| Setup & run instructions | `README.md` |
| Architecture note | `ARCHITECTURE.md` |
| AI workflow note | `AI_WORKFLOW.md` |
| This manifest | `SUBMISSION.md` |
| Live product URL | _<paste deployed URL>_ |
| Walkthrough video link | `walkthrough.txt` |
| Test accounts | alice@ajaia.test, bob@ajaia.test, carol@ajaia.test (click to sign in, no passwords) |
| Screenshots | `screenshots/` (documents home, editor, File menu, share dialog, edited-by-other-user banner) |

## Status
**Stretch goals included:** Editor/Viewer roles; Markdown/text export and Save-as-PDF; collaboration indicators (last edited by, "edited by someone else" banner).

**Working end to end:** create / rename / edit / autosave / reopen; bold, italic, underline, H1-H3, bullet and numbered lists; `.txt` / `.md` / `.docx` import into a new document; sharing with Can edit / View only roles, change and revoke; owned vs shared listing with badges; persistence across refresh; validation and error handling; 15 automated tests.

**Incomplete / deliberately out of scope:** real authentication, true real-time collaboration (changes by others are detected and flagged within ~5 s, but not merged; last-write-wins), version history, comments, server-side PDF (the PDF option uses the browser print dialog), attaching original uploads.

**Next with 2-4 more hours:** Yjs real-time collaboration and presence, version history, PDF export, real auth, Playwright E2E tests.
