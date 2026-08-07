"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Task } from "@/lib/types";
import { usePrototype } from "@/lib/store";

const TODAY = "2026-07-08"; // fixed prototype date

/** How many fit in a cell before the rest collapse behind "+N more". */
const VISIBLE_PER_DAY = 3;

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const monthName = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const longDate = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** A dot whose colour carries the same meaning as the board column. */
function ColumnDot({ column }: { column: Task["column"] }) {
  const tone =
    column === "done"
      ? "bg-success"
      : column === "blocked"
        ? "bg-danger"
        : column === "in-progress" || column === "in-review" || column === "qa"
          ? "bg-ink"
          : "bg-line";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone}`} aria-hidden />;
}

/**
 * A month of work, by the day each task is due.
 *
 * It shows tasks rather than sprint boundaries because a sprint has two dates
 * and tells you nothing about the days between them. A crowded day collapses
 * behind "+N more" instead of growing the row, and the whole day opens for the
 * detail that does not fit in a cell.
 */
export function TaskCalendar({
  tasks,
  hrefFor,
  contextFor,
}: {
  tasks: Task[];
  /** Where a task's board lives — differs per component at project level. */
  hrefFor: (task: Task) => string;
  /** Extra line under the title, e.g. which Module the task belongs to. */
  contextFor?: (task: Task) => string;
}) {
  const { members } = usePrototype();
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(6); // July (0-indexed)
  const [openDay, setOpenDay] = useState<string | null>(null);

  const memberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "Unassigned";

  const byDay = new Map<string, Task[]>();
  for (const task of tasks) {
    const list = byDay.get(task.dueDate) ?? [];
    list.push(task);
    byDay.set(task.dueDate, list);
  }

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

  const dayTasks = openDay ? (byDay.get(openDay) ?? []) : [];

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
          <div
            key={day}
            className="label border-b border-r border-line bg-soft px-2 py-1.5"
          >
            {day}
          </div>
        ))}

        {cells.map((day, i) => {
          const dateStr = day ? iso(year, month, day) : "";
          const todays = day ? (byDay.get(dateStr) ?? []) : [];
          const isToday = dateStr === TODAY;
          const hidden = todays.length - VISIBLE_PER_DAY;

          return (
            <div
              key={i}
              className={`min-h-24 border-b border-r border-line p-1.5 ${
                day ? "" : "bg-soft"
              }`}
            >
              {day && (
                <>
                  {todays.length > 0 ? (
                    <button
                      onClick={() => setOpenDay(dateStr)}
                      className={`inline-flex h-5 min-w-5 items-center justify-center px-1 text-[11px] tabular-nums hover:bg-soft ${
                        isToday
                          ? "bg-black font-semibold text-paper hover:bg-black"
                          : "text-muted"
                      }`}
                      aria-label={`${longDate(dateStr)} — ${todays.length} ${
                        todays.length === 1 ? "task" : "tasks"
                      }`}
                    >
                      {day}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex h-5 min-w-5 items-center justify-center px-1 text-[11px] tabular-nums ${
                        isToday
                          ? "bg-black font-semibold text-paper"
                          : "text-muted"
                      }`}
                    >
                      {day}
                    </span>
                  )}

                  <div className="mt-1 space-y-1">
                    {todays.slice(0, VISIBLE_PER_DAY).map((task) => (
                      <Link
                        key={task.id}
                        href={hrefFor(task)}
                        title={`${task.title} — ${memberName(task.assigneeId)}`}
                        className="flex items-center gap-1 truncate border-l-2 border-l-line bg-soft px-1 py-0.5 text-[10px] leading-tight text-ink hover:border-l-black"
                      >
                        <ColumnDot column={task.column} />
                        <span className="truncate">{task.title}</span>
                      </Link>
                    ))}

                    {hidden > 0 && (
                      <button
                        onClick={() => setOpenDay(dateStr)}
                        className="w-full px-1 text-left text-[10px] font-medium text-muted hover:text-ink"
                      >
                        +{hidden} more
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {openDay && (
        <DayDetail
          date={openDay}
          tasks={dayTasks}
          hrefFor={hrefFor}
          contextFor={contextFor}
          memberName={memberName}
          onClose={() => setOpenDay(null)}
        />
      )}
    </div>
  );
}

/** Everything due on one day — the detail a 10px cell cannot hold. */
function DayDetail({
  date,
  tasks,
  hrefFor,
  contextFor,
  memberName,
  onClose,
}: {
  date: string;
  tasks: Task[];
  hrefFor: (task: Task) => string;
  contextFor?: (task: Task) => string;
  memberName: (id: string) => string;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes from anywhere, not only when the panel has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const points = tasks.reduce((sum, t) => sum + t.estimate, 0);

  return (
    <div
      className="animate-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/25 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Work due on ${longDate(date)}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="animate-in flex max-h-[80vh] w-full max-w-lg flex-col border border-black bg-paper"
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <div className="label">Due this day</div>
            <h3 className="mt-1 text-lg font-semibold tracking-tight text-ink">
              {longDate(date)}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"} · {points} pts
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-xs text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="divide-y divide-line overflow-y-auto">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={hrefFor(task)}
              onClick={onClose}
              className="block px-6 py-4 hover:bg-soft"
            >
              <div className="flex items-baseline gap-2">
                <ColumnDot column={task.column} />
                <span className="text-sm font-medium text-ink">{task.title}</span>
              </div>
              <div className="mt-1 pl-3.5 text-xs text-muted">
                {contextFor && <>{contextFor(task)} · </>}
                {task.componentName}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-3.5 text-[11px] text-muted">
                <span>{memberName(task.assigneeId)}</span>
                <span className="tabular-nums">{task.estimate} pts</span>
                <span className="capitalize">{task.column.replace("-", " ")}</span>
                <span className="capitalize">{task.priority} priority</span>
              </div>
              {task.blockers.map((b) => (
                <p key={b.id} className="mt-2 pl-3.5 text-[11px] text-danger">
                  <span className="font-medium">{b.category}</span> — {b.text}
                </p>
              ))}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
