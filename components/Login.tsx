"use client";
import { useEffect, useState } from "react";
import { api, json } from "@/lib/client";

type U = { id: string; name: string; email: string };

export default function Login() {
  const [users, setUsers] = useState<U[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ users: U[] }>("/api/users")
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e.message));
  }, []);

  async function signIn(id: string) {
    try {
      await api("/api/session", json("POST", { userId: id }));
      window.location.href = "/";
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="login">
      <div className="card login-card">
        <h1>Ajaia Docs</h1>
        <p className="muted">
          Demo sign-in: pick a seeded account. Use a second browser profile (or Switch user) to test sharing between users.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}>
              <button className="user-btn" onClick={() => signIn(u.id)}>
                <span className="avatar">{u.name[0]}</span>
                <span>
                  <strong>{u.name}</strong>
                  <br />
                  <small className="muted">{u.email}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">Mocked authentication for review purposes only; there are no passwords.</p>
      </div>
    </main>
  );
}
