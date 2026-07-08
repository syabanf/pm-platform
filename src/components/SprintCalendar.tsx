"use client";

import { useState } from "react";
import type { Sprint } from "@/lib/types";

const TODAY = "2026-07-08";

interface CalEvent {
  date: string;
  label: string;
  tone: "start" | "review";
}

const monthName = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function SprintCalendar({ sprints }: { sprints: Sprint[] }) {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(6); // July (0-indexed)

  const events: CalEvent[] = sprints.flatMap((sprint) => [
    {
      date: sprint.startDate,
      label: `Sprint ${String(sprint.number).padStart(2, "0")} starts`,
      tone: "start" as const,
    },
    {
      date: sprint.endDate,
      label: `Sprint ${String(sprint.number).padStart(2, "0")} review & demo`,
      tone: "review" as const,
    },
  ]);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // Monday-first grid
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-ink">
          {monthName(year, month)}
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => shift(-1)}
            className="border border-line px-2.5 py-1 text-xs text-muted hover:border-black hover:text-ink"
            aria-label="Previous month"
          >
            ←
          </button>
          <button
            onClick={() => shift(1)}
            className="border border-line px-2.5 py-1 text-xs text-muted hover:border-black hover:text-ink"
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 border-l border-t border-line text-xs">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="label border-b border-r border-line bg-soft px-2 py-1.5">
            {day}
          </div>
        ))}
        {cells.map((day, i) => {
          const dateStr = day ? iso(year, month, day) : "";
          const dayEvents = events.filter((e) => e.date === dateStr);
          const isToday = dateStr === TODAY;
          return (
            <div
              key={i}
              className={`min-h-20 border-b border-r border-line p-1.5 ${
                day ? "" : "bg-soft"
              }`}
            >
              {day && (
                <>
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center text-[11px] tabular-nums ${
                      isToday ? "bg-black font-semibold text-paper" : "text-muted"
                    }`}
                  >
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {dayEvents.map((event) => (
                      <div
                        key={event.label}
                        title={event.label}
                        className={`truncate border-l-2 px-1 py-0.5 text-[10px] leading-tight ${
                          event.tone === "start"
                            ? "border-l-black bg-soft text-ink"
                            : "border-l-success bg-soft text-ink"
                        }`}
                      >
                        {event.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
