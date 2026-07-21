"use client";

import { usePrototype } from "@/lib/store";

const TODO_COLUMNS = ["selected", "ready", "blocked"];
const FLIGHT_COLUMNS = ["in-progress", "in-review", "qa"];

/** Points per sprint member across the three broad states — who carries how much. */
export function WorkloadView({ sprintId }: { sprintId: string }) {
  const { tasks, members, sprints } = usePrototype();
  const sprint = sprints.find((s) => s.id === sprintId);
  const sprintTasks = tasks.filter((t) => t.sprintId === sprintId);

  const memberIds =
    sprint?.members.map((m) => m.memberId) ??
    [...new Set(sprintTasks.map((t) => t.assigneeId))];

  const rows = memberIds
    .map((memberId) => {
      const member = members.find((m) => m.id === memberId);
      const mine = sprintTasks.filter((t) => t.assigneeId === memberId);
      const sum = (cols: string[]) =>
        mine
          .filter((t) => cols.includes(t.column))
          .reduce((s, t) => s + t.estimate, 0);
      return {
        memberId,
        name: member?.name ?? memberId,
        roleLabel: member?.roleLabel ?? "",
        todo: sum(TODO_COLUMNS),
        inFlight: sum(FLIGHT_COLUMNS),
        done: sum(["done"]),
        blocked: mine.some((t) => t.column === "blocked"),
      };
    })
    .sort((a, b) => b.todo + b.inFlight - (a.todo + a.inFlight));

  const maxTotal = Math.max(
    ...rows.map((r) => r.todo + r.inFlight + r.done),
    1
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-5 text-[11px] uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-line" /> To do
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-muted" /> In flight
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 bg-black" /> Done
        </span>
      </div>
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((row) => {
          const total = row.todo + row.inFlight + row.done;
          return (
            <li key={row.memberId} className="grid gap-2 py-4 md:grid-cols-[180px_1fr_90px] md:items-center md:gap-6">
              <div>
                <div className="text-sm font-medium text-ink">{row.name}</div>
                <div className="text-xs text-muted">{row.roleLabel}</div>
              </div>
              <div className="flex h-5 w-full items-stretch bg-soft">
                {total > 0 && (
                  <>
                    <div
                      className="animate-grow-x bg-black"
                      style={{ width: `${(row.done / maxTotal) * 100}%` }}
                      title={`Done: ${row.done} pts`}
                    />
                    <div
                      className="animate-grow-x bg-muted"
                      style={{ width: `${(row.inFlight / maxTotal) * 100}%` }}
                      title={`In flight: ${row.inFlight} pts`}
                    />
                    <div
                      className="animate-grow-x bg-line"
                      style={{ width: `${(row.todo / maxTotal) * 100}%` }}
                      title={`To do: ${row.todo} pts`}
                    />
                  </>
                )}
              </div>
              <div className="text-right text-sm tabular-nums">
                <span className="font-semibold text-ink">{total} pts</span>
                {row.blocked && (
                  <span className="ml-2 text-[11px] uppercase tracking-wide text-danger">
                    blocked
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">
        Story points per member, computed live from the board. Segments: done ·
        in flight (in progress, review, QA) · to do (selected, ready, blocked).
      </p>
    </div>
  );
}
