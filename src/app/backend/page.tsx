"use client";

import { useState } from "react";
import { api, login, logout, getSessionToken } from "@/lib/api";

/**
 * The wiring, proven end to end.
 *
 * The app still runs on the in-memory store; this page is the one place the two
 * halves actually talk, so the seam can be seen working before the store is
 * moved onto it. It signs in against the real backend through the same-origin
 * proxy, keeps the session token the typed client attaches, and lists real
 * clients from the database — proxy → auth → typed GET → rows on screen, every
 * request shaped by the generated types.
 *
 * It is a developer tool, not a product screen: a live smoke test for the
 * connection. The full move of the store onto this client — all collections,
 * mutations written back — is the next slice.
 */
export default function BackendProbe() {
  const [email, setEmail] = useState("admin@wit.id");
  const [password, setPassword] = useState("wit-admin-changeme");
  const [status, setStatus] = useState<string>(
    getSessionToken() ? "signed in" : "signed out"
  );
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<
    { id: string; name: string; industry: string; status: string }[]
  >([]);

  const doLogin = async () => {
    setError(null);
    try {
      const user = await login(email, password);
      setStatus(`signed in as ${user.email} (${user.role})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign-in failed");
      setStatus("signed out");
    }
  };

  const loadClients = async () => {
    setError(null);
    const { data, error: err, response } = await api.GET("/clients", {
      params: { query: { limit: 50 } },
    });
    if (err || !data) {
      setError(`GET /clients → ${response.status}`);
      return;
    }
    setClients(data as typeof clients);
  };

  const doLogout = async () => {
    await logout();
    setStatus("signed out");
    setClients([]);
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="label">Developer tool</div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        Backend connection
      </h1>
      <p className="mt-2 text-sm text-muted">
        Signs in against the live Go backend through the proxy and lists real
        clients from Postgres. The app itself still runs in memory — this is the
        seam, proven.
      </p>

      <div className="mt-8 border border-line p-5">
        <div className="label">Session</div>
        <p className="mt-1 text-sm text-ink">{status}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label mb-1 block">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-line px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="label mb-1 block">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={doLogin}
            className="border border-black bg-black px-3 py-2 text-sm font-medium text-paper hover:bg-ink"
          >
            Sign in to backend
          </button>
          <button
            onClick={loadClients}
            className="border border-line px-3 py-2 text-sm text-ink hover:border-black"
          >
            Load clients
          </button>
          <button
            onClick={doLogout}
            className="border border-line px-3 py-2 text-sm text-muted hover:border-black hover:text-ink"
          >
            Sign out
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {clients.length > 0 && (
        <div className="mt-6 border border-line">
          <div className="border-b border-line px-5 py-3">
            <span className="label">
              {clients.length} clients — live from the database
            </span>
          </div>
          <ul className="divide-y divide-line">
            {clients.map((c) => (
              <li key={c.id} className="flex items-baseline justify-between px-5 py-3">
                <span className="text-sm font-medium text-ink">{c.name}</span>
                <span className="text-xs text-muted">
                  {c.industry} · {c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
