"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { usePrototype } from "@/lib/store";

/** Brand launch splash shown until the auth session is resolved. */
function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight text-ink">WIT</span>
        <span className="h-3 w-3 rounded-full bg-brand" aria-hidden />
      </div>
    </div>
  );
}

/** The workspace did not load: say why, and offer the two ways out. */
function LoadFailed({
  reason,
  retry,
  signOut,
}: {
  reason: string | null;
  retry: () => void;
  signOut: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-5">
      <div className="w-full max-w-sm rounded-card bg-card p-6 shadow-card">
        <h1 className="text-lg font-semibold text-ink">
          Could not load the workspace<span className="text-accent">.</span>
        </h1>
        <p className="mt-2 text-sm text-muted">
          {reason ?? "The backend did not answer."} Check that the API is
          running, then try again.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={retry}
            className="h-10 rounded-full bg-accent-strong px-5 text-sm font-medium text-on-ink shadow-glow transition-colors hover:bg-accent-dark"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={signOut}
            className="h-10 rounded-full bg-surface-2 px-5 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Auth gate + chrome switch:
 * - /login renders bare (no shell); redirects to / if already signed in.
 * - Every other route requires a session, else redirects to /login.
 * - The rest of the app renders inside the AppShell.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, authHydrated, loadState, loadError, retryLoad, logout } =
    usePrototype();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!authHydrated) return;
    if (!currentUser && !isLogin) router.replace("/login");
    if (currentUser && isLogin) router.replace("/");
  }, [authHydrated, currentUser, isLogin, router]);

  if (loadState === "error") {
    return <LoadFailed reason={loadError} retry={retryLoad} signOut={logout} />;
  }
  if (!authHydrated) return <Splash />;
  if (isLogin) return currentUser ? <Splash /> : <>{children}</>; // redirecting to /
  if (!currentUser) return <Splash />; // redirecting to /login
  return <AppShell>{children}</AppShell>;
}
