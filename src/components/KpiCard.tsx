"use client";

import { useEffect, useState } from "react";

/**
 * Counts a whole-number KPI up on mount.
 *
 * The initial state is the final value, so SSR and a JS-less render are both
 * correct; the animation only ever runs as an enhancement. Non-numeric values
 * ("In Progress"), decimals and 0 are returned untouched — a rolling decimal
 * reads as noise rather than polish.
 */
function useCountUp(value: string | number) {
  const [display, setDisplay] = useState<string | number>(value);

  // Derive-from-props: a changed target shows immediately, then the effect
  // below animates towards it. Keeps state out of the effect body.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDisplay(value);
  }

  useEffect(() => {
    if (typeof value !== "number" || !Number.isInteger(value) || value === 0) {
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 600);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return display;
}

export function KpiCard({
  value,
  label,
  delta,
  tone = "neutral",
}: {
  value: string | number;
  label: string;
  delta?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const shown = useCountUp(value);
  const valueColor =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-ink";
  return (
    <div className="border border-line bg-paper p-6">
      <div
        className={`text-5xl font-semibold tracking-tight tabular-nums ${valueColor}`}
      >
        {shown}
      </div>
      <div className="label mt-3">{label}</div>
      {delta && <div className="mt-1 text-xs text-muted">{delta}</div>}
    </div>
  );
}
