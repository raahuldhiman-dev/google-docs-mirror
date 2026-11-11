"use client";
import { useEffect, useState } from "react";
import { api, json } from "@/lib/client";

type Share = { userId: string; name: string; email: string; role: "editor" | "viewer" };
type U = { id: string; name: string; email: string };

export default function ShareDialog({ docId, onClose }: { docId: string; onClose: () => void }) {
  const [shares, setShares] = useState<Share[]>([]);
  const [users, setUsers] = useState<U[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ shares: Share[] }>(`/api/documents/${docId}/shares`)
      .then((r) => setShares(r.shares))
      .catch((e) => setError(e.message));
    api<{ users: U[] }>("/api/users")
      .then((r) => setUsers(r.users))
      .catch(() => {});
  }, [docId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ shares: Share[] }>(`/api/documents/${docId}/shares`, json("POST", { email, role }));
      setShares(r.shares);
      setEmail("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(userId: string) {
    setError("");
    try {
      await api(`/api/documents/${docId}/shares/${userId}`, { method: "DELETE" });
      setShares((s) => s.filter((x) => x.userId !== userId));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const unshared = users.filter((u) => !shares.some((s) => s.userId === u.id));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card dialog" role="dialog" aria-modal="true" aria-label="Share document" onClick={(e) => e.stopPropagation()}>
        <h2>Share document</h2>
        <form onSubmit={add} className="share-form">
          <input
            type="email"
            required
            list="known-users"
            placeholder="Email, e.g. bob@ajaia.test"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email of person to share with"
          />
          <datalist id="known-users">
            {unshared.map((u) => (
              <option key={u.id} value={u.email}>
                {u.name}
              </option>
            ))}
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} aria-label="Permission">
            <option value="editor">Can edit</option>
            <option value="viewer">View only</option>
          </select>
          <button className="btn primary" disabled={busy}>
            Share
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <h3>People with access</h3>
        {shares.length === 0 ? (
          <p className="empty">Only you can see this document.</p>
        ) : (
          <ul className="share-list">
            {shares.map((s) => (
              <li key={s.userId}>
                <span>
                  <strong>{s.name}</strong> <span className="muted small">{s.email}</span>
                </span>
                <span className="spacer" />
                <select
                  value={s.role}
                  aria-label={`Permission for ${s.name}`}
                  onChange={async (e) => {
                    setError("");
                    try {
                      const r = await api<{ shares: Share[] }>(
                        `/api/documents/${docId}/shares`,
                        json("POST", { email: s.email, role: e.target.value }),
                      );
                      setShares(r.shares);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">View only</option>
                </select>
                <button className="link-btn danger" onClick={() => revoke(s.userId)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
