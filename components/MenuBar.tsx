"use client";
import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { docToMarkdown, docToText, safeFilename } from "@/lib/export";

type Item = { label: string; hint?: string; run: () => void; disabled?: boolean } | "sep";
type Menu = { name: string; items: Item[] };

function download(filename: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Print dialog doubles as "Save as PDF"; the document title becomes the default PDF filename.
function printAs(title: string) {
  const prev = document.title;
  document.title = title;
  window.print();
  document.title = prev;
}

export default function MenuBar({
  editor,
  canEdit,
  title,
  onNew,
  onRename,
}: {
  editor: Editor | null;
  canEdit: boolean;
  title: string;
  onNew: () => void;
  onRename: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const chain = () => editor?.chain().focus();
  const fmt = (label: string, hint: string | undefined, fn: () => void): Item => ({ label, hint, run: fn, disabled: !canEdit || !editor });

  const menus: Menu[] = [
    {
      name: "File",
      items: [
        { label: "New document", run: onNew },
        canEdit ? { label: "Rename", run: onRename } : { label: "Rename", run: onRename, disabled: true },
        "sep",
        { label: "Download as Markdown (.md)", run: () => editor && download(safeFilename(title, "md"), docToMarkdown(editor.getJSON()), "text/markdown") },
        { label: "Download as plain text (.txt)", run: () => editor && download(safeFilename(title, "txt"), docToText(editor.getJSON()), "text/plain") },
        { label: "Save as PDF (via print dialog)", run: () => printAs(title) },
        "sep",
        { label: "Print", hint: "Ctrl+P", run: () => printAs(title) },
      ],
    },
    {
      name: "Edit",
      items: [
        fmt("Undo", "Ctrl+Z", () => chain()?.undo().run()),
        fmt("Redo", "Ctrl+Y", () => chain()?.redo().run()),
        "sep",
        { label: "Select all", hint: "Ctrl+A", run: () => chain()?.selectAll().run(), disabled: !editor },
      ],
    },
    {
      name: "Format",
      items: [
        fmt("Bold", "Ctrl+B", () => chain()?.toggleBold().run()),
        fmt("Italic", "Ctrl+I", () => chain()?.toggleItalic().run()),
        fmt("Underline", "Ctrl+U", () => chain()?.toggleUnderline().run()),
        "sep",
        fmt("Normal text", undefined, () => chain()?.setParagraph().run()),
        fmt("Heading 1", undefined, () => chain()?.setHeading({ level: 1 }).run()),
        fmt("Heading 2", undefined, () => chain()?.setHeading({ level: 2 }).run()),
        fmt("Heading 3", undefined, () => chain()?.setHeading({ level: 3 }).run()),
        "sep",
        fmt("Bulleted list", undefined, () => chain()?.toggleBulletList().run()),
        fmt("Numbered list", undefined, () => chain()?.toggleOrderedList().run()),
      ],
    },
  ];

  return (
    <div className="gd-menubar" role="menubar" ref={ref}>
      {menus.map((m) => (
        <div key={m.name} className="gd-menu-wrap">
          <button
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === m.name}
            className={`gd-menubtn ${open === m.name ? "open" : ""}`}
            onClick={() => setOpen(open === m.name ? null : m.name)}
            onMouseEnter={() => open && setOpen(m.name)}
          >
            {m.name}
          </button>
          {open === m.name && (
            <div className="gd-dropdown" role="menu">
              {m.items.map((it, i) =>
                it === "sep" ? (
                  <hr key={i} />
                ) : (
                  <button
                    key={it.label}
                    role="menuitem"
                    disabled={it.disabled}
                    onClick={() => {
                      setOpen(null);
                      it.run();
                    }}
                  >
                    <span>{it.label}</span>
                    {it.hint && <span className="hint">{it.hint}</span>}
                  </button>
                ),
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
