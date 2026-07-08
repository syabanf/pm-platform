"use client";

import Link from "next/link";
import type { Sprint } from "@/lib/types";
import { sprintPath } from "@/lib/data";

const TODAY = "2026-07-08"; // fixed prototype date

const toDate = (s: string) => new Date(`${s}T00:00:00`);
const DAY = 24 * 60 * 60 * 1000;

export function SprintGantt({ sprints }: { sprints: Sprint[] }) {
  if (sprints.length === 0) return null;
  const ordered = [...sprints].sort((a, b) => a.number - b.number);

  const min = Math.min(...ordered.map((s) => toDate(s.startDate).getTime())) - 2 * DAY;
  const max = Math.max(...ordered.map((s) => toDate(s.endDate).getTime())) + 3 * DAY;
  const span = max - min;
  const pct = (t: number) => ((t - min) / span) * 100;

  // weekly ticks (Mondays)
  const ticks: { pct: number; label: string }[] = [];
  const cursor = new Date(min);
  cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7)); // next Monday
  while (cursor.getTime() < max) {
    ticks.push({
      pct: pct(cursor.getTime()),
      label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  const todayPct = pct(toDate(TODAY).getTime());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* axis */}
        <div className="relative ml-44 h-6 border-b border-line">
          {ticks.map((tick) => (
            <span
              key={tick.pct}
              className="absolute top-0 text-[10px] tabular-nums text-muted"
              style={{ left: `${tick.pct}%` }}
            >
              {tick.label}
            </span>
          ))}
        </div>

        <div className="relative">
          {/* gridlines + today line spanning all rows */}
          <div className="pointer-events-none absolute inset-y-0 left-44 right-0">
            {ticks.map((tick) => (
              <span
                key={tick.pct}
                className="absolute inset-y-0 w-px bg-line"
                style={{ left: `${tick.pct}%` }}
              />
            ))}
            <span
              className="absolute inset-y-0 w-px bg-danger"
              style={{ left: `${todayPct}%` }}
            />
            <span
              className="absolute -top-0 text-[10px] font-medium uppercase tracking-wide text-danger"
              style={{ left: `calc(${todayPct}% + 4px)` }}
            >
              Today
            </span>
          </div>

          {ordered.map((sprint) => {
            const left = pct(toDate(sprint.startDate).getTime());
            const width =
              pct(toDate(sprint.endDate).getTime() + DAY) - left;
            const progress = Math.round(
              (sprint.completed / sprint.committed) * 100
            );
            return (
              <div key={sprint.id} className="flex items-center border-b border-line py-4">
                <div className="w-44 shrink-0 pr-4">
                  <div className="text-sm font-medium text-ink">
                    Sprint {String(sprint.number).padStart(2, "0")}
                  </div>
                  <div className="truncate text-xs text-muted">{sprint.name}</div>
                </div>
                <div className="relative h-7 flex-1">
                  <Link
                    href={`${sprintPath(sprint)}/board`}
                    title={`${sprint.goal} — ${progress}% complete`}
                    className={`absolute inset-y-0 flex items-center overflow-hidden border px-2 text-[11px] font-medium transition-colors ${
                      sprint.status === "done"
                        ? "border-black bg-black text-paper"
                        : sprint.status === "active"
                          ? "border-black bg-paper text-ink hover:bg-soft"
                          : "border-dashed border-muted text-muted"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  >
                    {sprint.status === "active" && (
                      <span
                        className="absolute inset-y-0 left-0 bg-line"
                        style={{ width: `${progress}%` }}
                      />
                    )}
                    <span className="relative whitespace-nowrap">
                      {sprint.status === "done"
                        ? `${progress}% · done`
                        : sprint.status === "active"
                          ? `${progress}% · ${sprint.daysLeft}d left`
                          : "planned"}
                    </span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Click a bar to open that sprint&apos;s board.
        </p>
      </div>
    </div>
  );
}
