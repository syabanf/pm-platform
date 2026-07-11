"use client";

import { use } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { SprintGantt } from "@/components/SprintGantt";
import { SprintCalendar } from "@/components/SprintCalendar";
import { sprintPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";
import { SectionHeader } from "@/components/ui";

export default function SprintsListPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const { products, sprints: allSprints, viewPrefs, setViewPref } =
    usePrototype();
  const product = products.find((p) => p.id === productId);
  const sprints = allSprints
    .filter((s) => s.productId === productId)
    .sort((a, b) => b.number - a.number);
  const componentName = (moduleId: string) =>
    product?.modules.find((m) => m.id === moduleId)?.name ?? "—";
  const view = viewPrefs.sprints;

  return (
    <div>
      <SectionHeader
        title="Sprints"
        description="All sprints in this module, grouped by the component that owns them."
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
            No sprints yet. Add one from a component on the Components tab.
          </p>
        ) : view === "gantt" ? (
          <SprintGantt sprints={sprints} />
        ) : view === "calendar" ? (
          <SprintCalendar sprints={sprints} />
        ) : (
          <DataTable
            headers={["Sprint", "Component", "Goal", "Period", "Committed", "Completed", "Status"]}
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
                <td className="py-4 pr-6 text-muted">
                  {componentName(sprint.moduleId)}
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
