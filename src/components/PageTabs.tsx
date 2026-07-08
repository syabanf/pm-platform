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
    <div className="flex gap-6 border-b border-line overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm transition-colors ${
              active
                ? "border-brand font-semibold text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
