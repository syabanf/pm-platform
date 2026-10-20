"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface Tab {
  label: string;
  href: string;
  exact?: boolean;
}

export function PageTabs({ tabs }: { tabs: Tab[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Section"
      className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-card p-1 shadow-card"
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-ink text-on-ink"
                : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
