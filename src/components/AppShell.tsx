"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import {
  CommandPalette,
  useCommandPalette,
} from "@/components/CommandPalette";
import { OnlineStatus } from "@/components/OnlineStatus";
import { HowToWizard, useHowTo } from "@/components/HowToWizard";
import { DemoTour } from "@/components/DemoTour";
import { usePrototype } from "@/lib/store";

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

const staticNavTop: NavItem[] = [
  {
    label: "Home",
    href: "/",
    children: [
      { label: "Needs Attention", href: "/#triage" },
      { label: "Portfolio", href: "/#portfolio" },
      { label: "AI Insight", href: "/#insight" },
    ],
  },
];

const staticNavBottom: NavItem[] = [
  {
    label: "Reports",
    href: "/reports",
    children: [
      { label: "All Reports", href: "/reports" },
      { label: "Sprint Reports", href: "/reports?type=Sprint+Report" },
      { label: "Module Reports", href: "/reports?type=Module+Report" },
      { label: "Client Reports", href: "/reports?type=Client+Report" },
    ],
  },
  {
    label: "AI Coach",
    href: "/ai-coach",
    children: [
      { label: "Portfolio Insights", href: "/ai-coach#portfolio" },
      { label: "Module Insights", href: "/ai-coach#modules" },
    ],
  },
  {
    label: "Documents",
    href: "/documents",
    children: [
      { label: "MoM", href: "/documents/mom" },
      { label: "Status Update", href: "/documents/status-update" },
      { label: "Change Request", href: "/documents/change-request" },
      { label: "UAT Sign-off", href: "/documents/uat-signoff" },
      { label: "Kickoff Charter", href: "/documents/kickoff" },
    ],
  },
  {
    label: "Settings",
    href: "/settings",
    children: [
      { label: "Workspace", href: "/settings" },
      { label: "Members", href: "/settings/members" },
      { label: "Roles & Permissions", href: "/settings/roles" },
      { label: "Report Templates", href: "/settings/report-templates" },
      { label: "Lists", href: "/settings/lists" },
      { label: "Definition of Done", href: "/settings/dod" },
    ],
  },
];

// Notify on back/forward AND programmatic pushState/replaceState (Next's
// router), so query-only navigation updates subscribers too.
const subscribeToHistory = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  const origPush = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState = (...args) => {
    origPush(...args);
    callback();
  };
  history.replaceState = (...args) => {
    origReplace(...args);
    callback();
  };
  return () => {
    window.removeEventListener("popstate", callback);
    history.pushState = origPush;
    history.replaceState = origReplace;
  };
};
const getTypeParam = () =>
  new URLSearchParams(window.location.search).get("type");

function SidebarNav() {
  const pathname = usePathname();
  // Read the query string from the URL directly instead of useSearchParams()
  // — avoids the Suspense deopt that dropped the sidebar on dynamic-route
  // hard loads. Re-reads on every render (pathname changes) and on popstate.
  const typeParam = useSyncExternalStore(
    subscribeToHistory,
    getTypeParam,
    () => null
  );
  const { clients } = usePrototype();

  const nav: NavItem[] = [
    ...staticNavTop,
    {
      label: "Clients",
      href: "/clients",
      children: clients.map((c) => ({
        label: c.name,
        href: `/clients/${c.id}`,
      })),
    },
    ...staticNavBottom,
  ];

  const isParentActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  const isChildActive = (href: string) => {
    if (href.includes("#")) return false; // hash targets: no active state
    if (href.includes("?")) {
      const [path, qs] = href.split("?");
      return (
        pathname === path &&
        new URLSearchParams(qs).get("type") === typeParam
      );
    }
    if (pathname === href) return !typeParam;
    if (href === "/settings") return false; // exact-only (child list root)
    return pathname.startsWith(href + "/");
  };


  return (
    <nav className="flex-1 overflow-y-auto px-3" aria-label="Primary">
      {nav.map((item) => {
        const active = isParentActive(item.href);
        return (
          <div key={item.href} className="mb-1">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative block px-3 py-2.5 text-sm transition-colors ${
                active ? "font-semibold text-black" : "text-muted hover:text-ink"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-brand" />
              )}
              {item.label}
            </Link>
            {item.children && (
              <div className="ml-4 border-l border-line">
                {item.children.map((child) => {
                  const childActive = isChildActive(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      aria-current={childActive ? "page" : undefined}
                      className={`relative block px-3 py-1.5 text-[13px] transition-colors ${
                        childActive
                          ? "font-semibold text-black"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {childActive && (
                        <span className="absolute -left-px top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-brand" />
                      )}
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

const TAB_ROOTS = ["/", "/clients", "/reports", "/documents", "/ai-coach", "/settings"];

const SEGMENT_LABELS: Record<string, string> = {
  modules: "Components",
  mom: "MoM",
  "status-update": "Status Update",
  "change-request": "Change Request",
  "uat-signoff": "UAT Sign-off",
  kickoff: "Kickoff Charter",
  dod: "Definition of Done",
  "report-templates": "Report Templates",
  lists: "Lists",
  roles: "Roles",
  burndown: "Charts",
};

const pretty = (segment: string) =>
  SEGMENT_LABELS[segment] ??
  segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");

/** Native-app page title for the phone top bar, derived from store + pathname. */
function usePageTitle(pathname: string): string {
  const { clients, projects, products } = usePrototype();
  const segs = pathname.split("/").filter(Boolean);

  const prodIdx = segs.indexOf("products");
  if (prodIdx >= 0 && segs[prodIdx + 1]) {
    const product = products.find((p) => p.id === segs[prodIdx + 1]);
    if (product) {
      const rest = segs.slice(prodIdx + 2);
      let tab = "";
      if (rest[0] === "sprints" && rest[1] && rest[2]) tab = pretty(rest[2]);
      else if (rest[0] === "sprints" && rest[1]) tab = "Sprint";
      else if (rest[0]) tab = pretty(rest[0]);
      return tab ? `${product.name} · ${tab}` : product.name;
    }
  }
  const projIdx = segs.indexOf("projects");
  if (projIdx >= 0 && segs[projIdx + 1]) {
    const project = projects.find((p) => p.id === segs[projIdx + 1]);
    if (project) return project.name;
  }
  if (segs[0] === "clients" && segs[1]) {
    const client = clients.find((c) => c.id === segs[1]);
    if (client) return client.name;
  }
  return pretty(segs[segs.length - 1] ?? "");
}

/** Records visited product/sprint pages for the Home "Jump back in" strip. */
function RouteTracker() {
  const pathname = usePathname();
  const { products, recordRecentPath } = usePrototype();

  useEffect(() => {
    const match = pathname.match(/\/products\/([^/]+)(?:\/(.+))?/);
    if (!match) return;
    const product = products.find((p) => p.id === match[1]);
    if (!product) return;
    const rest = match[2];
    let suffix = "";
    if (rest?.includes("sprints/")) {
      const tab = rest.split("/").pop();
      suffix = ` · Sprint ${tab === "board" ? "board" : tab}`;
    } else if (rest) {
      suffix = ` · ${rest.split("/")[0]}`;
    }
    recordRecentPath(pathname, `${product.name}${suffix}`);
  }, [pathname, products, recordRecentPath]);

  return null;
}

function Brand() {
  const { workspaceConf } = usePrototype();
  const [first, ...rest] = workspaceConf.name.split(" ");
  return (
    <Link href="/" className="block">
      <div className="flex items-center gap-1.5">
        <span className="text-lg font-bold tracking-tight text-ink">
          {first}
        </span>
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: workspaceConf.brandColor }}
          aria-hidden
        />
      </div>
      <div className="label mt-0.5">{rest.join(" ") || workspaceConf.company}</div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Drawer gestures: swipe in from the left edge to open, swipe left to close.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDrawerTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipe.current = { x: t.clientX, y: t.clientY };
  };
  const drawerSwipe = (e: React.TouchEvent, open: boolean) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (open && dx > 0) setDrawerOpen(true);
    if (!open && dx < 0) setDrawerOpen(false);
  };
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { currentUser } = usePrototype();
  // Auto-opens once for a signed-in first-time user; reopenable from the sidebar.
  const { open: howToOpen, setOpen: setHowToOpen } = useHowTo(!!currentUser);
  const [demoOpen, setDemoOpen] = useState(false);
  const playDemo = () => {
    setHowToOpen(false);
    setDrawerOpen(false);
    setDemoOpen(true);
  };
  const initial = currentUser?.name.charAt(0) ?? "?";
  const isTabRoot = TAB_ROOTS.includes(pathname);
  const pageTitle = usePageTitle(pathname);

  // Close the drawer whenever navigation happens (derive-from-prop pattern).
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  return (
    <div className="flex min-h-screen">
      {/* Keyboard users: jump straight past the nav to page content. */}
      <a
        href="#main-content"
        className="sr-only z-[100] border border-black bg-paper px-4 py-2 text-sm font-medium text-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <RouteTracker />
      <OnlineStatus />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <HowToWizard
        open={howToOpen}
        onClose={() => setHowToOpen(false)}
        onPlayDemo={playDemo}
      />
      <DemoTour open={demoOpen} onClose={() => setDemoOpen(false)} />

      {/* Swipe in from the left edge to open the drawer (touch, mobile only). */}
      {!drawerOpen && (
        <div
          aria-hidden
          className="fixed inset-y-0 left-0 z-30 w-5 lg:hidden"
          onTouchStart={onDrawerTouchStart}
          onTouchEnd={(e) => drawerSwipe(e, true)}
        />
      )}

      {/* Mobile / tablet-portrait top bar */}
      <header className="print-hide fixed inset-x-0 top-0 z-40 h-[calc(3.5rem+env(safe-area-inset-top))] border-b border-line bg-paper px-4 pt-[env(safe-area-inset-top)] lg:hidden">
        {/* Phone, nested page: native back + title bar */}
        {!isTabRoot && (
          <div className="flex h-full items-center gap-2 md:hidden">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12.5 4.5 7 10l5.5 5.5" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="truncate text-sm font-semibold text-ink">
                {pageTitle}
              </div>
            </div>
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="flex h-10 w-10 shrink-0 items-center justify-center border border-line text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="9" r="5.5" />
                <path d="m13.5 13.5 4 4" />
              </svg>
            </button>
          </div>
        )}

        {/* Tab roots (all sizes) and tablet (always): hamburger + brand */}
        <div
          className={`${isTabRoot ? "flex" : "hidden md:flex"} h-full items-center justify-between`}
        >
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            aria-label="Toggle navigation"
            aria-expanded={drawerOpen}
            className="flex h-10 w-10 flex-col items-center justify-center gap-1 border border-line"
          >
            <span
              className={`h-0.5 w-4 bg-black transition-transform duration-200 ${drawerOpen ? "translate-y-1.5 rotate-45" : ""}`}
            />
            <span
              className={`h-0.5 w-4 bg-black transition-opacity duration-200 ${drawerOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`h-0.5 w-4 bg-black transition-transform duration-200 ${drawerOpen ? "-translate-y-1.5 -rotate-45" : ""}`}
            />
          </button>
          <Brand />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="flex h-10 w-10 items-center justify-center border border-line text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="9" r="5.5" />
                <path d="m13.5 13.5 4 4" />
              </svg>
            </button>
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex h-8 w-8 items-center justify-center bg-black text-xs font-semibold text-paper"
            >
              {initial}
            </Link>
          </div>
        </div>
      </header>

      {/* Backdrop for the drawer */}
      {drawerOpen && (
        <div
          className="animate-fade fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        onTouchStart={onDrawerTouchStart}
        onTouchEnd={(e) => drawerSwipe(e, false)}
        className={`print-hide fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-paper transition-transform duration-200 ease-out lg:z-30 lg:w-56 lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-6 py-8">
          <Brand />
        </div>
        <div className="px-4 pb-4">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center justify-between border border-line px-3 py-2 text-xs text-muted hover:border-black hover:text-ink"
          >
            <span>Search…</span>
            <span className="border border-line px-1 py-0.5 text-[10px]">⌘K</span>
          </button>
        </div>
        <SidebarNav />
        <div className="flex gap-2 px-4 pb-2">
          <button
            onClick={() => setHowToOpen(true)}
            className="flex flex-1 items-center gap-2 border border-line px-3 py-2 text-xs text-muted hover:border-black hover:text-ink"
          >
            <span
              aria-hidden
              className="flex h-4 w-4 items-center justify-center border border-current text-[10px] font-medium leading-none"
            >
              ?
            </span>
            How to use
          </button>
          <button
            onClick={playDemo}
            title="Play a guided demo"
            className="flex items-center gap-1.5 border border-line px-3 py-2 text-xs text-muted hover:border-black hover:text-ink"
          >
            <span aria-hidden className="text-[9px] leading-none">
              ▶
            </span>
            Demo
          </button>
        </div>
        <div className="border-t border-line px-3 py-4">
          <Link
            href="/profile"
            className="mt-2 flex items-center gap-3 rounded-none px-3 py-1.5 transition-colors hover:bg-soft"
          >
            <span className="flex h-8 w-8 items-center justify-center bg-black text-xs font-semibold text-paper">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-ink">
                {currentUser?.name ?? "Guest"}
              </span>
              <span className="block truncate text-[11px] text-muted">
                {currentUser?.roleLabel ?? "Not signed in"}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        // min-w-0 is load-bearing: as a flex child, main defaults to
        // min-width:auto and refuses to shrink below its widest content, so a
        // wide table would stretch the whole page and defeat the inner
        // overflow-x-auto containers. Without it the phone scrolls sideways.
        className="min-h-screen min-w-0 flex-1 bg-paper pb-20 pt-[calc(3.5rem+env(safe-area-inset-top))] focus:outline-none lg:ml-56 lg:pb-0 lg:pt-0"
      >
        {children}
      </main>

      {/* App-style tab bar on mobile / tablet portrait */}
      <BottomNav />
    </div>
  );
}
