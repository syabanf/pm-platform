"use client";

import { use, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { SprintGantt } from "@/components/SprintGantt";
import { TaskCalendar } from "@/components/TaskCalendar";
import {
  SprintPanel,
  draftFromSprint,
  emptySprintDraft,
  type SprintDraft,
} from "@/components/SprintPanel";
import { productPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";
import { Button, EmptyState, FilterBar, SectionHeader, allOf } from "@/components/ui";
import type { Sprint } from "@/lib/types";

export default function SprintsListPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const {
    products,
    sprints: allSprints,
    tasks,
    sprintsCrud,
    showToast,
    viewPrefs,
    setViewPref,
  } = usePrototype();
  const product = products.find((p) => p.id === productId);
  const base = product ? productPath(product) : "";
  const components = product?.modules ?? [];
  const sprints = allSprints
    .filter((s) => s.productId === productId)
    .sort((a, b) => b.number - a.number);
  const componentName = (moduleId: string) =>
    components.find((m) => m.id === moduleId)?.name ?? "—";
  const view = viewPrefs.sprints;

  const [statusFilter, setStatusFilter] = useState("all");
  const [componentFilter, setComponentFilter] = useState("all");
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SprintDraft>(() => emptySprintDraft());

  const filtered = sprints.filter(
    (s) =>
      (statusFilter === "all" || s.status === statusFilter) &&
      (componentFilter === "all" || s.moduleId === componentFilter)
  );

  const openCreate = () => {
    setEditingId(null);
    // Pre-select the component being filtered on: if you are looking at one
    // component's sprints, that is the one you mean to add to.
    setDraft(
      emptySprintDraft(
        componentFilter !== "all"
          ? componentFilter
          : components.length === 1
            ? components[0].id
            : ""
      )
    );
    setPanelOpen(true);
  };

  const openEdit = (sprint: Sprint) => {
    setEditingId(sprint.id);
    setDraft(draftFromSprint(sprint));
    setPanelOpen(true);
  };

  return (
    <div>
      <SectionHeader
        title="Sprints"
        description="Every sprint in this module. Add, reschedule or remove them here — no need to open the component first."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher
              options={[
                { id: "list" as const, label: "List" },
                { id: "gantt" as const, label: "Gantt" },
                { id: "calendar" as const, label: "Calendar" },
              ]}
              value={view}
              onChange={(v) => setViewPref("sprints", v)}
            />
            {components.length > 0 && (
              <Button
                size="sm"
                onClick={() =>
                  panelOpen && !editingId ? setPanelOpen(false) : openCreate()
                }
              >
                Add Sprint
              </Button>
            )}
          </div>
        }
      />

      {panelOpen && (
        <SprintPanel
          productId={productId}
          components={components}
          editingId={editingId}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setPanelOpen(false)}
        />
      )}

      {sprints.length > 0 && (
        <FilterBar
          className="mt-6"
          groups={[
            {
              label: "Status",
              value: statusFilter,
              onChange: setStatusFilter,
              options: allOf([
                { value: "planning", label: "Planning" },
                { value: "active", label: "Active" },
                { value: "review", label: "Review" },
                { value: "done", label: "Done" },
              ]),
            },
            {
              label: "Component",
              value: componentFilter,
              onChange: setComponentFilter,
              options: allOf(
                components.map((m) => ({ value: m.id, label: m.name }))
              ),
            },
          ]}
          summary={`${filtered.length} of ${sprints.length}`}
        />
      )}

      <div className="mt-6">
        {sprints.length === 0 ? (
          <EmptyState>
            <p className="text-sm text-muted">
              No sprints yet. A sprint is a block of dated work owned by one
              component.
            </p>
            {components.length > 0 ? (
              <Button size="sm" className="mt-4" onClick={openCreate}>
                Add the first sprint
              </Button>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Add a component first —{" "}
                <Link href={`${base}/modules`} className="text-ink underline">
                  Components
                </Link>{" "}
                — because a sprint needs one to belong to.
              </p>
            )}
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState>
            <p className="text-sm text-muted">No sprints match the filters.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-4"
              onClick={() => {
                setStatusFilter("all");
                setComponentFilter("all");
              }}
            >
              Clear filters
            </Button>
          </EmptyState>
        ) : view === "gantt" ? (
          <SprintGantt
            sprints={filtered}
            hrefFor={(s) => `${base}/sprints/${s.id}/board`}
          />
        ) : view === "calendar" ? (
          <TaskCalendar
            tasks={tasks.filter((t) =>
              filtered.some((s) => s.id === t.sprintId)
            )}
            hrefFor={(t) => `${base}/sprints/${t.sprintId}/board`}
          />
        ) : (
          <DataTable
            headers={[
              "Sprint",
              "Component",
              "Goal",
              "Period",
              "Committed",
              "Completed",
              "Status",
              "",
            ]}
          >
            {filtered.map((sprint) => (
              <tr key={sprint.id}>
                <td className="py-4 pr-6">
                  <Link
                    href={`${base}/sprints/${sprint.id}/board`}
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
                <td className="py-4 pr-6">
                  <StatusPill status={sprint.status} />
                </td>
                <td className="py-4 text-right">
                  {/* Always visible: a control you can only find by hovering
                      does not exist on a touch screen. */}
                  <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(sprint)}
                      className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                    >
                      Edit
                    </button>
                    <ConfirmButton
                      onConfirm={() => {
                        sprintsCrud.remove(sprint.id);
                        showToast(
                          `Sprint ${String(sprint.number).padStart(
                            2,
                            "0"
                          )} removed.`,
                          "info"
                        );
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </div>
  );
}
