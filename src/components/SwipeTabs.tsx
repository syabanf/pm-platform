"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Tab } from "@/components/PageTabs";

const SWIPE_MIN = 56; // px of horizontal travel before it counts
const H_DOMINANCE = 1.4; // horizontal must beat vertical by this factor

/** True if the touch began inside something that scrolls horizontally (a table,
 *  the board, the Gantt) — there we must leave the native scroll alone. */
function startedInScrollX(target: EventTarget | null, stop: Element): boolean {
  let node = target as Element | null;
  while (node && node !== stop && node !== document.body) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const ox = getComputedStyle(node).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Wraps the content under a PageTabs bar and turns a clear horizontal swipe into
 * moving to the previous / next tab — the native "swipe between menus" feel.
 * Touch-only by nature (touch events never fire from a mouse), and it never
 * calls preventDefault, so vertical scrolling and inner horizontal scrollers
 * keep working untouched.
 */
export function SwipeTabs({
  tabs,
  children,
  className,
}: {
  tabs: Tab[];
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; skip: boolean } | null>(null);

  const index = tabs.findIndex((t) =>
    t.exact
      ? pathname === t.href
      : pathname === t.href || pathname.startsWith(t.href + "/")
  );

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      start.current = null;
      return;
    }
    const t = e.touches[0];
    start.current = {
      x: t.clientX,
      y: t.clientY,
      skip: ref.current
        ? startedInScrollX(e.target, ref.current)
        : false,
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current;
    start.current = null;
    if (!s || s.skip || index < 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * H_DOMINANCE)
      return;
    const next = tabs[index + (dx < 0 ? 1 : -1)]; // swipe left → next tab
    if (next) router.push(next.href);
  };

  return (
    <div
      ref={ref}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={className}
    >
      {children}
    </div>
  );
}
