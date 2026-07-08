"use client";

import { use } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { SprintGantt } from "@/components/SprintGantt";
import { SprintCalendar } from "@/components/SprintCalendar";
import { sprintPath, sprintsOfProduct } from "@/lib/data";
import { usePrototype } from "@/lib/store";
import { SectionHeader } from "@/components/ui";

export default function SprintsListPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const sprints = sprintsOfProduct(productId);
  const { viewPrefs, setViewPref } = usePrototype();
  const view = viewPrefs.sprints;

  return (
    <div>
      <SectionHeader
        title="Sprints"
        description="All sprints for this product. Each sprint carries its own backlog and tasks."
        actions={
          <ViewSwitcher
            options={[
              { id: "list" as const, label: "List" },
              { id: "gantt" as const, label: "Gantt" },
              { id: "calendar" as const, label: "Calendar" },
            ]}
            value={view}
            onChange={(v) => setViewPref("sprints", v)}
          />
        }
      />

      <div className="mt-6">
        {sprints.length === 0 ? (
          <p className="border-y border-line py-8 text-center text-sm text-muted">
            No sprints yet for this product in the prototype dataset.
          </p>
        ) : view === "gantt" ? (
          <SprintGantt sprints={sprints} />
        ) : view === "calendar" ? (
          <SprintCalendar sprints={sprints} />
        ) : (
          <DataTable
            headers={["Sprint", "Goal", "Period", "Committed", "Completed", "Status"]}
          >
            {sprints.map((sprint) => (
              <tr key={sprint.id}>
                <td className="py-4 pr-6">
                  <Link
                    href={`${sprintPath(sprint)}/board`}
                    className="font-medium text-ink hover:underline"
                  >
                    Sprint {String(sprint.number).padStart(2, "0")}
                  </Link>
                  <div className="text-xs text-muted">{sprint.name}</div>
                </td>
                <td className="max-w-xs py-4 pr-6 text-muted">{sprint.goal}</td>
                <td className="py-4 pr-6 text-xs tabular-nums text-muted">
                  {sprint.startDate} → {sprint.endDate}
                </td>
                <td className="py-4 pr-6 tabular-nums">{sprint.committed} pts</td>
                <td className="py-4 pr-6 tabular-nums">{sprint.completed} pts</td>
                <td className="py-4">
                  <StatusPill status={sprint.status} />
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
