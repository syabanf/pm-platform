"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { members, workspaceDefaults } from "@/lib/data";
import { Button, Input } from "@/components/ui";
import { usePrototype } from "@/lib/store";

const DEMO_IDS = ["fahmi", "risya", "reyza", "christian"];

export default function LoginPage() {
  const router = useRouter();
  const { login } = usePrototype();
  const [email, setEmail] = useState("fahmi@wit.id");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const signIn = (memberId: string) => {
    login(memberId);
    router.replace("/");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Enter an email and password to continue.");
      return;
    }
    // Dummy auth: match a seed member by email, else sign in as the lead.
    const match = members.find(
      (m) => m.email.toLowerCase() === email.trim().toLowerCase()
    );
    signIn(match?.id ?? "fahmi");
  };

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Brand panel */}
      <div className="flex flex-col justify-between border-b border-line bg-soft px-6 py-8 md:w-1/2 md:border-b-0 md:border-r md:px-14 md:py-14">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-ink">WIT</span>
          <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          <span className="label ml-1">Sprint OS</span>
        </div>
        <div className="hidden md:block">
          <h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight text-ink">
            From client request to sprint delivery.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted">
            AI-native Agile delivery for consulting teams — structured backlog,
            focused sprints, and client-ready reports.
          </p>
        </div>
        <div className="hidden text-xs text-muted md:block">
          {workspaceDefaults.company} · Prototype
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 md:px-14">
        <div className="w-full max-w-sm">
          <div className="label">Sign in</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            Welcome back.
          </h2>
          <p className="mt-1 text-sm text-muted">
            Prototype sign-in — any password works.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <label className="label mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="you@wit.id"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="label mb-1.5 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <Button type="submit" size="lg" fullWidth>
              Sign in
            </Button>
          </form>

          <div className="mt-8 border-t border-line pt-6">
            <div className="label mb-3">Demo accounts — one click</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_IDS.map((id) => {
                const member = members.find((m) => m.id === id);
                if (!member) return null;
                return (
                  <button
                    key={id}
                    onClick={() => signIn(id)}
                    className="flex items-center gap-2.5 border border-line px-3 py-2 text-left transition-colors hover:border-black"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-soft text-[11px] font-semibold text-ink">
                      {member.name.charAt(0)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {member.name}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        {member.roleLabel}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
