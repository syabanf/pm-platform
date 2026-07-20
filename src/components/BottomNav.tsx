"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const icons: Record<string, React.ReactNode> = {
  Home: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 9.5 10 3l7 6.5V17h-5v-4h-4v4H3V9.5Z" />
    </svg>
  ),
  Clients: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="13.5" cy="8.5" r="2" />
      <path d="M2.5 16c.5-3 2.5-4.5 4.5-4.5S11 13 11.5 16M11.5 12.5c1.5 0 3.5 1 4 3.5" />
    </svg>
  ),
  Reports: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="4" y="3" width="12" height="14" />
      <path d="M7 12v2M10 9v5M13 6v8" />
    </svg>
  ),
  Docs: (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5 3h7l3 3v11H5V3Z" />
      <path d="M12 3v3h3M8 10h4M8 13h4" />
    </svg>
  ),
  "AI Coach": (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3.5" y="5" width="13" height="10" />
      <circle cx="8" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M10 5V2.5" />
    </svg>
  ),
};

const tabs = [
  { label: "Home", href: "/" },
  { label: "Clients", href: "/clients" },
  { label: "Reports", href: "/reports" },
  { label: "AI Coach", href: "/ai-coach" },
  { label: "Docs", href: "/documents" },
];

export function BottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      className="print-hide fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="Bottom navigation"
    >
      {tabs.map((tab) => {
        const active = isActive(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[10px] font-medium uppercase tracking-wide ${
              active ? "font-semibold text-ink" : "text-muted"
            }`}
          >
            {active && (
              <span className="absolute inset-x-4 top-0 h-0.5 bg-brand" />
            )}
            {icons[tab.label]}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
