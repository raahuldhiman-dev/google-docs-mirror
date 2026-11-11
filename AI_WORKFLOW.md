# AI workflow note

## Tools used
- **Claude Code** (CLI/VS Code extension, Claude Sonnet 5.5) as the main pairing tool: planning, scaffolding, writing code, running tests and a scripted headless-browser check.
- Nothing else generated code.

## Where AI materially sped me up
- **Scoping.** I had the model turn the assignment into a requirement-to-module map with time budgets *before* writing code, and used it to decide cuts (no real-time collab, no stored originals).
- **Boilerplate and glue.** Route handlers, zod schemas, the Tiptap toolbar wiring, the share dialog and CSS were fast to generate and easy to review.
- **Test and verification loops.** It wrote the Vitest suite and a Playwright-style browser script that drove the real flow (create → format → reload → share → switch user → view-only), which would have taken me much longer by hand.
- **Docs.** First drafts of README / architecture note.
- **Walkthrough video.** The screen capture was recorded by a scripted headless browser run against the live site (Claude Code wrote the script, so the cursor movement is automated and the typing is scripted). The captions follow my written script, and the narration is my own voice, recorded over the capture.

## What I changed or rejected
These are real corrections made during the build:
- **Dependency choices.** The first test-runner install (vitest 5) conflicted with the pinned toolchain; I pinned vitest 2 instead of forcing the install. Tiptap v3's StarterKit already bundles Underline, so I dropped the separate underline extension I had planned to add to avoid duplicate-extension warnings.
- **Autosave bug.** My first draft of the debounced saver re-queued edits made during an in-flight save using a timer check that could never be true, so those edits would not have been saved until the next keystroke. I rewrote that branch so it reschedules explicitly after a successful save, and re-queues the patch (without clobbering newer edits) on failure.
- **Config bug.** `process.env.TURSO_URL ?? "file:…"` ignores the fallback when the variable is set but empty (exactly what copying `.env.example` produces). Changed to `||`.
- **Access semantics.** I chose 404 (not 403) for users with no access to a document so ids cannot be probed, and kept 403 only for users who have access but lack a permission. This was a product/security decision I made; the model's default would have returned 403 everywhere.
- **UI bugs found by looking at screenshots, not by tests.** (1) The documents table had misaligned rows because the generated code made a `<td>` `display:flex`, which breaks table layout; fixed by wrapping the cell content in a div. (2) At phone width the "All changes saved" status overlapped the document title; fixed with a wrapping header. Both passed type-check and unit tests, which is why I review rendered output as well.
- **A cold-start race that only appeared on the live deploy.** My database setup seeded a welcome document with a plain `INSERT` guarded by "table is empty". Locally that is fine, but on Vercel several instances start at once, all see an empty table and race, so the loser failed with `UNIQUE constraint failed: documents.id` and every route returned 500. I reproduced it first with a failing test (several `initDb` calls in parallel), then made the seed and the column migration idempotent (`INSERT OR IGNORE`, tolerate "duplicate column"). I also added `/api/health`, which reports which settings are present without revealing them, so a misconfigured deployment explains itself.
- **Scope.** I declined adding Yjs real-time sync, version history and PDF export even though the model could generate them quickly: they'd have enlarged the surface to verify and jeopardised the core flows. I added only stretch items that were cheap to verify: Markdown/text export (a pure function), PDF via the browser print dialog, and polling-based "edited by someone else" detection. I deliberately did not call the latter real-time collaboration, because it detects conflicts but doesn't merge them.

## How I verified correctness and quality
- **Automated:** `npm test` (15 tests) against an in-memory database covering the access matrix, sharing upsert/revoke, listing, validation and import conversion. Type-check (`tsc --noEmit`) and a production `next build` are clean.
- **API smoke test with curl** against the production build using two sessions: unauthenticated → 401, no-access → 404, viewer write → 403, bad body → 400, unsupported upload → 400.
- **Browser check** (headless Chromium script, plus screenshots I looked at): formatting persisted across reload, autosave indicator reached "All changes saved", Bob saw the doc under "Shared with me" as view-only with no toolbar and a non-editable body, and there were no console errors.
- **Two-user collaboration check:** a scripted run with two separate browser sessions confirmed Alice sees no banner for her own saves, gets a banner within one poll after Bob's edit, and sees Bob's text after reloading.
- **Live smoke test** against the deployed URL in a real browser: seeded users listed; create, format, autosave and reload persistence; share with Bob as viewer (read-only UI, and a direct API write returns 403); Carol with no access gets 404; `.md` and real `.docx` import; `.pdf` rejected; the test documents were deleted afterwards.
- **Not verified:** very large `.docx` files, real Word documents with tables/images, a physical phone (only a 390px emulated viewport), and concurrent editing beyond the "edited by someone else" banner.

## Judgement note
I treated AI output as a draft: every file was read before moving on, and the bugs above were found by reviewing the generated logic and by running it, not by trusting it.
