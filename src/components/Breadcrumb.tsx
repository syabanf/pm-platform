import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted md:flex">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-line">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-ink transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-ink font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
