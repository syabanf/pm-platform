"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { resolveBranch, type BranchList, type BranchRow } from "@/lib/hierarchy";
import { usePrototype } from "@/lib/store";

/**
 * Where the sidebar shows you are in the hierarchy.
 *
 * The sidebar used to list every client, which is fine at three and unusable
 * at fifty, and then listed none at all, which made it a dead end. This is the
 * directory version: the branch you are standing in — client, project, module —
 * with the siblings at your level beside you.
 *
 * There is no expand/collapse state anywhere in this file, and that is the
 * design rather than an omission. A collapsible tree is bounded when it loads
 * and unbounded thereafter: one person opening three clients is back to the
 * list that was removed. This is a pure function of the URL, so it is nine rows
 * at three clients and nine rows at three thousand.
 *
 * Everything here is a link. No buttons: a link closes the mobile drawer for
 * free (it closes on pathname change), and a button in the sidebar would
 * collide with the page's own buttons in every page-wide test locator.
 */

/** Indent per level. Padding, not nested margins, which would cost 16px a step. */
const PAD = ["pl-3", "pl-5", "pl-7"] as const;

function Row({
  row,
  depth,
  currentRef,
}: {
  row: BranchRow;
  depth: 0 | 1 | 2;
  currentRef?: React.Ref<HTMLAnchorElement>;
}) {
  return (
    <li>
      <Link
        ref={currentRef}
        href={row.href}
        aria-current={row.ariaCurrent}
        title={row.label}
        // border-l-2 on every row, transparent when inactive, so the accent
        // never shifts the text sideways as you navigate.
        className={`flex min-w-0 items-center border-l-2 py-1.5 pr-2 text-[13px] transition-colors ${
          PAD[depth]
        } ${
          row.state === "current"
            ? "border-brand font-semibold text-black"
            : row.state === "ancestor"
              ? "border-transparent text-ink"
              : "border-transparent text-muted hover:text-ink"
        }`}
      >
        <span className="truncate">{row.label}</span>
      </Link>
    </li>
  );
}

function Overflow({ list, depth }: { list: BranchList; depth: 0 | 1 | 2 }) {
  const over = list.overflow;
  if (!over) return null;

  const label = `+ ${over.hiddenCount} more`;
  // Linking to the page you are already on is a dead click. On the client
  // page — which is exactly when this list is that client's projects — say so
  // instead.
  if (over.isCurrentPage) {
    return (
      <li>
        <span
          className={`block py-1.5 pr-2 text-[13px] text-muted ${PAD[depth]}`}
        >
          {label} on this page
        </span>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={over.href}
        // "+12 more" alone means nothing read out of context.
        aria-label={`See all ${over.total} ${over.noun} in ${over.parentName}`}
        className={`block border-l-2 border-transparent py-1.5 pr-2 text-[13px] text-muted transition-colors hover:text-ink ${PAD[depth]}`}
      >
        {label}
      </Link>
    </li>
  );
}

export function ClientBranch({ pathname }: { pathname: string }) {
  const { clients, projects, modules } = usePrototype();
  const currentRef = useRef<HTMLAnchorElement>(null);

  const branch = useMemo(
    () => resolveBranch({ clients, projects, modules }, pathname),
    [clients, projects, modules, pathname]
  );

  // The static nav above this is taller than the nav's scroll viewport on a
  // laptop, so arriving from ⌘K can land with the branch below the fold.
  // `block: "nearest"` is a no-op when it is already visible.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [branch?.currentKey]);

  if (!branch) return null;

  const isCurrent = (row: BranchRow) => row.href === branch.currentKey;

  return (
    <div className="ml-4 border-l border-line">
      {/*
        Nested <ul>s, each labelled, are what carry the hierarchy to a screen
        reader — the visible depth is padding, which no assistive technology
        can see. Deliberately not role="tree": that needs roving tabindex and
        arrow-key ownership inside a container that scrolls and a drawer that
        swipe-closes, and it would strip the link role these rows rely on.
      */}
      <ul aria-label={`In ${branch.clientName}`}>
        <Row
          row={branch.client}
          depth={0}
          currentRef={isCurrent(branch.client) ? currentRef : undefined}
        />
        <li>
          <ul aria-label={branch.projects.label}>
            {branch.projects.rows.map((row) => (
              <Row
                key={row.href}
                row={row}
                depth={1}
                currentRef={isCurrent(row) ? currentRef : undefined}
              />
            ))}
            <Overflow list={branch.projects} depth={1} />
            {branch.modules && (
              <li>
                <ul aria-label={branch.modules.label}>
                  {branch.modules.rows.map((row) => (
                    <Row
                      key={row.href}
                      row={row}
                      depth={2}
                      currentRef={isCurrent(row) ? currentRef : undefined}
                    />
                  ))}
                  <Overflow list={branch.modules} depth={2} />
                </ul>
              </li>
            )}
          </ul>
        </li>
      </ul>
    </div>
  );
}
