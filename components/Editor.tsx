"use client";
import { EditorContent, useEditor, useEditorState, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, json, timeAgo } from "@/lib/client";
import { BulletIcon, DocLogo, LockIcon, NumberedIcon, RedoIcon, UndoIcon } from "./icons";
import MenuBar from "./MenuBar";
import ShareDialog from "./ShareDialog";

type Role = "owner" | "editor" | "viewer";
type Doc = { id: string; title: string; ownerName: string; role: Role; content: object; updatedAt: number; updatedByName: string };
type Meta = { updatedAt: number; updatedById: string; updatedByName: string };
type SaveState = "saved" | "dirty" | "saving" | "error";

const SAVE_DELAY_MS = 800;
const POLL_MS = 5000;

function Toolbar({ editor }: { editor: TiptapEditor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      block: e.isActive("heading", { level: 1 })
        ? "1"
        : e.isActive("heading", { level: 2 })
          ? "2"
          : e.isActive("heading", { level: 3 })
            ? "3"
            : "0",
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const Btn = ({ on, label, title, onClick, disabled }: { on?: boolean; label: React.ReactNode; title: string; onClick: () => void; disabled?: boolean }) => (
    <button
      type="button"
      className={`tb ${on ? "active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={on}
      disabled={disabled}
      // mousedown keeps the editor selection from being lost when clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
  const chain = () => editor.chain().focus();
  const setBlock = (v: string) => {
    if (v === "0") chain().setParagraph().run();
    else chain().setHeading({ level: Number(v) as 1 | 2 | 3 }).run();
  };
  return (
    <div className="gd-toolbar" role="toolbar" aria-label="Formatting">
      <Btn title="Undo (Ctrl+Z)" label={<UndoIcon />} disabled={!s.canUndo} onClick={() => chain().undo().run()} />
      <Btn title="Redo (Ctrl+Y)" label={<RedoIcon />} disabled={!s.canRedo} onClick={() => chain().redo().run()} />
      <span className="sep" />
      <select className="gd-style-select" aria-label="Text style" value={s.block} onChange={(e) => setBlock(e.target.value)}>
        <option value="0">Normal text</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      <span className="sep" />
      <Btn title="Bold (Ctrl+B)" label={<b>B</b>} on={s.bold} onClick={() => chain().toggleBold().run()} />
      <Btn title="Italic (Ctrl+I)" label={<i>I</i>} on={s.italic} onClick={() => chain().toggleItalic().run()} />
      <Btn title="Underline (Ctrl+U)" label={<u>U</u>} on={s.underline} onClick={() => chain().toggleUnderline().run()} />
      <span className="sep" />
      <Btn title="Bulleted list" label={<BulletIcon />} on={s.bullet} onClick={() => chain().toggleBulletList().run()} />
      <Btn title="Numbered list" label={<NumberedIcon />} on={s.ordered} onClick={() => chain().toggleOrderedList().run()} />
    </div>
  );
}

export default function Editor({ docId, user }: { docId: string; user: { id: string; name: string } }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loadError, setLoadError] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [sharing, setSharing] = useState(false);
  const router = useRouter();
  // Change detection: the newest updatedAt this tab knows about (loaded or saved by us).
  const lastKnown = useRef(0);
  const [remoteEditor, setRemoteEditor] = useState<string | null>(null);
  const [lastEdit, setLastEdit] = useState<{ by: string; at: number } | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const canEdit = doc?.role === "owner" || doc?.role === "editor";

  // Pending changes live in refs so the debounced saver always sees the latest values.
  const pending = useRef<{ title?: string; content?: object }>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const inflight = useRef(false);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (inflight.current || !Object.keys(pending.current).length) return;
    const patch = pending.current;
    pending.current = {};
    inflight.current = true;
    setSaveState("saving");
    try {
      const { updatedAt } = await api<{ updatedAt: number }>(`/api/documents/${docId}`, json("PATCH", patch));
      lastKnown.current = updatedAt;
      setLastEdit({ by: user.name, at: updatedAt });
      setSaveError("");
      inflight.current = false;
      if (Object.keys(pending.current).length) {
        // Edits arrived while this save was in flight; their timer was skipped, so save again.
        setSaveState("dirty");
        timer.current = setTimeout(flush, SAVE_DELAY_MS);
      } else setSaveState("saved");
    } catch (e) {
      // Put the failed changes back (without clobbering newer edits) so Retry resends them.
      inflight.current = false;
      pending.current = { ...patch, ...pending.current };
      setSaveError((e as Error).message);
      setSaveState("error");
    }
  }, [docId, user.name]);

  const schedule = useCallback(
    (patch: { title?: string; content?: object }) => {
      pending.current = { ...pending.current, ...patch };
      setSaveState("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: doc?.content ?? "",
      editable: !!canEdit,
      immediatelyRender: false,
      editorProps: { attributes: { class: "prose", "aria-label": "Document body" } },
      onUpdate: ({ editor: e }) => schedule({ content: e.getJSON() }),
    },
    [doc?.id, canEdit],
  );

  useEffect(() => {
    api<Doc>(`/api/documents/${docId}`)
      .then((d) => {
        setDoc(d);
        setTitle(d.title);
        lastKnown.current = d.updatedAt;
        setLastEdit({ by: d.updatedByName, at: d.updatedAt });
      })
      .catch((e) => setLoadError(e.message));
  }, [docId]);

  // Poll for edits by other people (no websockets: keeps it deployable on serverless).
  useEffect(() => {
    if (!doc) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const m = await api<Meta>(`/api/documents/${docId}/meta`);
        if (m.updatedAt > lastKnown.current && m.updatedById !== user.id) {
          setRemoteEditor(m.updatedByName);
          setLastEdit({ by: m.updatedByName, at: m.updatedAt });
        }
      } catch {
        /* transient network errors are ignored; the next tick retries */
      }
    };
    const t = setInterval(tick, POLL_MS);
    return () => clearInterval(t);
  }, [doc, docId, user.id]);

  // Warn about unsaved work and make a best-effort save when leaving the page.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        fetch(`/api/documents/${docId}`, { ...json("PATCH", pending.current), keepalive: true }).catch(() => {});
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      flush();
    };
  }, [docId, flush]);

  if (loadError)
    return (
      <div className="page">
        <main className="container">
          <h2>Can&apos;t open this document</h2>
          <p className="error" role="alert">
            {loadError}
          </p>
          <Link href="/" className="btn">
            ← Back to documents
          </Link>
        </main>
      </div>
    );
  if (!doc) return <div className="page"><main className="container muted">Loading…</main></div>;

  const status = {
    saved: "All changes saved",
    dirty: "Unsaved changes…",
    saving: "Saving…",
    error: `Save failed: ${saveError}`,
  }[saveState];

  return (
    <div className="gd-editor-page">
      <header className="gd-editor-head">
        <Link href="/" className="gd-logo-link" aria-label="Back to documents" title="Back to documents">
          <DocLogo size={40} />
        </Link>
        <div className="gd-title-block">
          <input
            ref={titleRef}
            className="gd-title-input"
            value={title}
            maxLength={200}
            readOnly={!canEdit}
            aria-label="Document title"
            onChange={(e) => {
              setTitle(e.target.value);
              if (e.target.value.trim()) schedule({ title: e.target.value });
            }}
            onBlur={() => !title.trim() && setTitle(doc.title)}
          />
          <div className="gd-menu-row">
          <MenuBar
            editor={editor}
            canEdit={!!canEdit}
            title={title}
            onRename={() => titleRef.current?.select()}
            onNew={async () => {
              try {
                await flush();
                const { id } = await api<{ id: string }>("/api/documents", json("POST", {}));
                router.push(`/doc/${id}`);
              } catch (e) {
                setSaveError((e as Error).message);
                setSaveState("error");
              }
            }}
          />
          {lastEdit && (
            <span className="gd-lastedit" title={new Date(lastEdit.at).toLocaleString()}>
              Last edit by {lastEdit.by === user.name ? "you" : lastEdit.by} · {timeAgo(lastEdit.at)}
            </span>
          )}
          </div>
        </div>
        <span className="spacer" />
        {canEdit ? (
          <span className={`save-status ${saveState}`} role="status">
            {status}
          </span>
        ) : (
          <span className="save-status">
            <LockIcon size={13} /> View only
          </span>
        )}
        {saveState === "error" && (
          <button className="link-btn" onClick={flush}>
            Retry
          </button>
        )}
        {doc.role === "owner" ? (
          <button className="gd-share-btn" onClick={() => setSharing(true)}>
            <LockIcon size={18} /> Share
          </button>
        ) : (
          <span className={`badge badge-${doc.role}`}>{doc.role === "editor" ? "Can edit" : "View only"}</span>
        )}
        <span className="gd-avatar static" title={user.name}>
          {user.name[0]}
        </span>
      </header>

      {canEdit && editor && <Toolbar editor={editor} />}

      {remoteEditor && (
        <div className="banner banner-remote" role="alert">
          <strong>{remoteEditor}</strong> edited this document.{" "}
          {Object.keys(pending.current).length ? "You have unsaved changes; reloading will discard them. " : ""}
          <button className="link-btn" onClick={() => window.location.reload()}>
            Reload to see their changes
          </button>
        </div>
      )}

      {doc.role !== "owner" && (
        <div className="banner">
          Shared by {doc.ownerName}. {canEdit ? "You can edit this document." : "You have view-only access."}
        </div>
      )}

      <main className="gd-canvas">
        <div className="gd-page">
          <EditorContent editor={editor} />
        </div>
      </main>

      {sharing && <ShareDialog docId={doc.id} onClose={() => setSharing(false)} />}
    </div>
  );
}
