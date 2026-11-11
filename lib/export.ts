// Serialises the editor's ProseMirror JSON to Markdown / plain text (pure, so it is unit-tested).
type Mark = { type: string };
type Node = { type: string; text?: string; marks?: Mark[]; content?: Node[]; attrs?: Record<string, unknown> };

function inline(nodes: Node[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === "hardBreak") return "  \n";
      let t = n.text ?? "";
      if (!t) return "";
      const has = (m: string) => n.marks?.some((x) => x.type === m);
      if (has("code")) t = `\`${t}\``;
      if (has("bold")) t = `**${t}**`;
      if (has("italic")) t = `_${t}_`;
      if (has("strike")) t = `~~${t}~~`;
      if (has("underline")) t = `<u>${t}</u>`; // Markdown has no underline; inline HTML is the convention
      return t;
    })
    .join("");
}

function block(n: Node, indent = ""): string {
  switch (n.type) {
    case "heading":
      return `${"#".repeat(Number(n.attrs?.level ?? 1))} ${inline(n.content)}`;
    case "paragraph":
      return indent + inline(n.content);
    case "bulletList":
    case "orderedList": {
      const ordered = n.type === "orderedList";
      const start = Number(n.attrs?.start ?? 1);
      return (n.content ?? [])
        .map((li, i) => {
          const marker = ordered ? `${start + i}. ` : "- ";
          const [first, ...rest] = li.content ?? [];
          const head = first ? block(first).replace(/^\s+/, "") : "";
          const nested = rest.map((c) => block(c, indent + " ".repeat(marker.length))).join("\n");
          return `${indent}${marker}${head}${nested ? "\n" + nested : ""}`;
        })
        .join("\n");
    }
    case "blockquote":
      return (n.content ?? []).map((c) => block(c)).join("\n\n").replace(/^/gm, "> ");
    case "codeBlock":
      return "```\n" + inline(n.content) + "\n```";
    case "horizontalRule":
      return "---";
    default:
      return inline(n.content);
  }
}

export function docToMarkdown(doc: unknown): string {
  const nodes = ((doc as Node)?.content ?? []) as Node[];
  const out: string[] = [];
  for (const n of nodes) {
    const md = block(n);
    // Lists are tight, but consecutive blank paragraphs should not pile up.
    if (md.trim() || n.type !== "paragraph") out.push(md);
  }
  return out.join("\n\n").trim() + "\n";
}

export function docToText(doc: unknown): string {
  const walk = (n: Node): string => {
    if (n.type === "text") return n.text ?? "";
    if (n.type === "hardBreak") return "\n";
    const kids = n.content ?? [];
    if (n.type === "bulletList") return kids.map((li) => "• " + walk(li)).join("\n");
    if (n.type === "orderedList") return kids.map((li, i) => `${i + 1}. ` + walk(li)).join("\n");
    if (n.type === "listItem") return kids.map(walk).join("\n");
    if (n.type === "doc") return kids.map(walk).filter((s, i, a) => s || (a[i - 1] ?? "")).join("\n\n");
    return kids.map(walk).join("");
  };
  return walk(doc as Node).trim() + "\n";
}

export function safeFilename(title: string, ext: string) {
  const base = title.replace(/[\\/:*?"<>|]+/g, "").trim().slice(0, 80) || "document";
  return `${base}.${ext}`;
}
