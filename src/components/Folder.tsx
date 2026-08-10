"use client";

import { useId } from "react";

/**
 * One collapsible group in a directory.
 *
 * Lists that only ever grow — clients, projects — stop being readable as one
 * flat table long before anyone notices. A directory keeps them navigable:
 * scan the folder headers, open the one you want.
 *
 * The collapse is the `.animate-collapse` grid trick already used on Home: a
 * `0fr → 1fr` row transition on the wrapper, with the inner div supplying the
 * overflow clip. It needs both wrappers, which is why this is a shared
 * component rather than a pattern copied twice more.
 */
export function Folder({
  label,
  count,
  meta,
  open,
  onToggle,
  children,
}: {
  /** The folder's name — an industry, a year. */
  label: string;
  /** How many rows are inside, shown so a closed folder still informs. */
  count: number;
  /** Optional extra note on the right of the header. */
  meta?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const regionId = useId();

  return (
    <div className="border border-line">
      <button
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center gap-2.5 bg-soft px-4 py-3 text-left hover:bg-line/40"
      >
        <svg
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${
            open ? "rotate-90" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span className="text-sm font-semibold text-ink">{label}</span>
        <span className="text-xs tabular-nums text-muted">({count})</span>
        {meta && <span className="ml-auto text-xs text-muted">{meta}</span>}
      </button>
      {/*
        `inert` is what makes a closed folder actually closed. The grid collapse
        takes the height to zero and clips the overflow, but the rows inside
        keep their own boxes — so without this they stay in the tab order and a
        screen reader still reads them out of a folder the user shut.
      */}
      <div
        id={regionId}
        className="animate-collapse"
        data-open={open}
        inert={!open}
      >
        <div>
          {/*
            Horizontal padding here, not on the caller: a table dropped into a
            folder has no page container to inset it, so without this its first
            and last columns sit flush against the folder border. `border-t`
            still spans the full width — padding is inside the border box.
          */}
          <div className="border-t border-line px-5 pb-2">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Groups rows under a key, preserving each group's input order.
 * Returns entries already sorted by the caller's comparator.
 */
export function groupBy<T>(
  rows: T[],
  key: (row: T) => string,
  sort: (a: string, b: string) => number
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  return [...groups.entries()].sort((a, b) => sort(a[0], b[0]));
}
