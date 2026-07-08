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

/**
 * Auth gate + chrome switch:
 * - /login renders bare (no shell); redirects to / if already signed in.
 * - Every other route requires a session, else redirects to /login.
 * - The rest of the app renders inside the AppShell.
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, authHydrated } = usePrototype();
  const isLogin = pathname === "/login";

  useEffect(() => {
    if (!authHydrated) return;
    if (!currentUser && !isLogin) router.replace("/login");
    if (currentUser && isLogin) router.replace("/");
  }, [authHydrated, currentUser, isLogin, router]);

  if (!authHydrated) return <Splash />;
  if (isLogin) return currentUser ? <Splash /> : <>{children}</>; // redirecting to /
  if (!currentUser) return <Splash />; // redirecting to /login
  return <AppShell>{children}</AppShell>;
}
