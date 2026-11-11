"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, json, timeAgo } from "@/lib/client";
import { DocLogo, MoreIcon, PlusIcon, SearchIcon, UploadIcon } from "./icons";

type Doc = { id: string; title: string; ownerName: string; role: "owner" | "editor" | "viewer"; updatedAt: number; updatedById: string; updatedByName: string };
type User = { id: string; name: string; email: string };
type Filter = "all" | "owned" | "shared";

const ROLE_LABEL = { owner: "Owner", editor: "Can edit", viewer: "View only" } as const;

export default function Dashboard({ user }: { user: User }) {
  const router = useRouter();
  const [owned, setOwned] = useState<Doc[]>([]);
  const [shared, setShared] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ owned: Doc[]; shared: Doc[] }>("/api/documents");
      setOwned(r.owned);
      setShared(r.shared);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const { id } = await api<{ id: string }>("/api/documents", json("POST", {}));
      router.push(`/doc/${id}`);
    });

  const rename = (d: Doc, title: string) => {
    setRenaming(null);
    if (!title.trim() || title === d.title) return;
    return run(async () => {
      await api(`/api/documents/${d.id}`, json("PATCH", { title }));
      await load();
    });
  };

  const remove = (d: Doc) => {
    if (!confirm(`Delete "${d.title}"? It will also disappear for anyone it is shared with.`)) return;
    return run(async () => {
      await api(`/api/documents/${d.id}`, { method: "DELETE" });
      await load();
    });
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    await run(async () => {
      const form = new FormData();
      form.append("file", file);
      const { id } = await api<{ id: string }>("/api/import", { method: "POST", body: form });
      router.push(`/doc/${id}`);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  async function signOut() {
    await api("/api/session", { method: "DELETE" });
    window.location.href = "/";
  }

  const docs = useMemo(() => {
    const all = filter === "owned" ? owned : filter === "shared" ? shared : [...owned, ...shared];
    const q = query.trim().toLowerCase();
    return all.filter((d) => !q || d.title.toLowerCase().includes(q)).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [owned, shared, filter, query]);

  const initial = user.name[0];

  return (
    <div className="gd-home">
      <header className="gd-appbar">
        <Link href="/" className="gd-brand" aria-label="Docs home">
          <DocLogo size={40} />
          <span>Docs</span>
        </Link>
        <label className="gd-search">
          <SearchIcon />
          <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search documents" />
        </label>
        <div className="gd-account">
          <span className="gd-user-name">{user.name}</span>
          <button className="gd-avatar" onClick={signOut} title={`${user.name} · click to switch user`} aria-label="Switch user">
            {initial}
          </button>
        </div>
      </header>

      <section className="gd-start">
        <div className="gd-wrap">
          <div className="gd-start-head">
            <span>Start a new document</span>
            <span className="gd-hint">Import supports .txt, .md and .docx (max 2 MB)</span>
          </div>
          <div className="gd-templates">
            <button className="gd-template" onClick={create} disabled={busy}>
              <span className="gd-thumb gd-thumb-blank">
                <PlusIcon size={56} />
              </span>
              <span className="gd-template-name">Blank document</span>
            </button>
            <button className="gd-template" onClick={() => fileRef.current?.click()} disabled={busy}>
              <span className="gd-thumb gd-thumb-import">
                <UploadIcon size={48} />
              </span>
              <span className="gd-template-name">Import file</span>
            </button>
            <input ref={fileRef} type="file" hidden accept=".txt,.md,.docx" onChange={(e) => upload(e.target.files?.[0])} />
          </div>
        </div>
      </section>

      <main className="gd-wrap gd-list-section">
        <div className="gd-list-head">
          <strong>Documents</strong>
          <div className="gd-filters" role="tablist" aria-label="Filter documents">
            {(
              [
                ["all", "All"],
                ["owned", "Owned by me"],
                ["shared", "Shared with me"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={`gd-chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="muted">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="empty">
            {query
              ? "No documents match your search."
              : filter === "shared"
                ? "Nothing has been shared with you yet."
                : "No documents yet. Start one above."}
          </p>
        ) : (
          <table className="gd-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Access</th>
                <th>Last modified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} onDoubleClick={() => router.push(`/doc/${d.id}`)}>
                  <td>
                    <div className="gd-name">
                      <DocLogo size={22} />
                      {renaming === d.id ? (
                        <input
                          className="rename-input"
                          autoFocus
                          defaultValue={d.title}
                          maxLength={200}
                          aria-label="Document title"
                          onBlur={(e) => rename(d, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setRenaming(null);
                          }}
                        />
                      ) : (
                        <Link href={`/doc/${d.id}`}>{d.title}</Link>
                      )}
                    </div>
                  </td>
                  <td>{d.role === "owner" ? "me" : d.ownerName}</td>
                  <td>
                    <span className={`badge badge-${d.role}`}>{ROLE_LABEL[d.role]}</span>
                  </td>
                  <td className="muted">
                    {timeAgo(d.updatedAt)} · {d.updatedById === user.id ? "me" : d.updatedByName}
                  </td>
                  <td className="gd-menu-cell">
                    {d.role !== "viewer" && (
                      <>
                        <button
                          className="gd-icon-btn"
                          aria-label={`Actions for ${d.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenu(menu === d.id ? null : d.id);
                          }}
                        >
                          <MoreIcon />
                        </button>
                        {menu === d.id && (
                          <div className="gd-menu" role="menu">
                            <button role="menuitem" onClick={() => setRenaming(d.id)}>
                              Rename
                            </button>
                            {d.role === "owner" && (
                              <button role="menuitem" onClick={() => remove(d)}>
                                Remove
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
