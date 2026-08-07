"use client";

import { use, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import {
  Button,
  EmptyState,
  FilterBar,
  KpiStrip,
  allOf,
} from "@/components/ui";
import {
  SprintPanel,
  draftFromSprint,
  emptySprintDraft,
  type SprintDraft,
} from "@/components/SprintPanel";
import { usePrototype } from "@/lib/store";
import type { Sprint } from "@/lib/types";

const readinessLabel: Record<string, string> = {
  ready: "Ready",
  "needs-clarification": "Needs Clarification",
  draft: "Draft",
};

const statusLabel: Record<string, string> = {
  planned: "Planned",
  "in-progress": "In Progress",
  done: "Done",
};

export default function ComponentDetailPage({
  params,
}: {
  params: Promise<{
    clientId: string;
    projectId: string;
    moduleId: string;
    componentId: string;
  }>;
}) {
  const { clientId, projectId, moduleId, componentId } = use(params);
  const { modules, sprints, backlog, sprintsCrud, showToast } = usePrototype();
  const base = `/clients/${clientId}/projects/${projectId}/modules/${moduleId}`;

  const mod = modules.find((p) => p.id === moduleId);
  const component = mod?.components.find((m) => m.id === componentId);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SprintDraft>(() => emptySprintDraft());
  const [sprintStatusFilter, setSprintStatusFilter] = useState("all");

  if (!mod || !component) {
    return (
      <EmptyState>
        Component not found — it may have been removed in this session.{" "}
        <Link href={`${base}/components`} className="text-ink underline">
          Back to Components
        </Link>
      </EmptyState>
    );
  }

  const componentSprints = sprints
    .filter((s) => s.moduleId === moduleId && s.componentId === componentId)
    .sort((a, b) => b.number - a.number);
  const filteredSprints = componentSprints.filter(
    (s) => sprintStatusFilter === "all" || s.status === sprintStatusFilter
  );
  const componentBacklog = backlog.filter(
    (b) => b.moduleId === moduleId && b.componentId === componentId
  );

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptySprintDraft(componentId));
    setPanelOpen(true);
  };

  const openEdit = (sprint: Sprint) => {
    setEditingId(sprint.id);
    setDraft(draftFromSprint(sprint));
    setPanelOpen(true);
  };

  return (
    <div>
      {/* Component sub-header — the drill-down level below Component */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted">
            <Link href={`${base}/components`} className="hover:text-ink">
              Components
            </Link>
            <span className="mx-1.5 text-line" aria-hidden>
              /
            </span>
            <span className="text-ink">{component.name}</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink">
            {component.name}
          </h2>
          <p className="mt-0.5 text-sm text-muted">Owner: {component.owner}</p>
        </div>
        <StatusPill status={component.status} label={statusLabel[component.status]} />
      </div>

      <KpiStrip
        className="mt-8"
        items={[
          { value: componentSprints.length, label: "Sprints" },
          { value: componentBacklog.length, label: "Backlog Items" },
          {
            value: statusLabel[component.status] ?? component.status,
            label: "Status",
          },
        ]}
      />

      {/* Sprints owned by this component */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h3 className="label">Sprints — this component</h3>
          <Button
            size="sm"
            onClick={() =>
              panelOpen && !editingId ? setPanelOpen(false) : openCreate()
            }
          >
            Add Sprint
          </Button>
        </div>

        {panelOpen && (
          <SprintPanel
            moduleId={moduleId}
            components={mod.components}
            lockedComponentId={componentId}
            editingId={editingId}
            draft={draft}
            setDraft={setDraft}
            onClose={() => setPanelOpen(false)}
          />
        )}

        <div className="mt-4">
          {componentSprints.length === 0 ? (
            <EmptyState>
              No sprints yet for this component. Add the first one to start
              planning.
            </EmptyState>
          ) : (
            <>
              <FilterBar
                className="mb-4"
                groups={[
                  {
                    label: "Status",
                    value: sprintStatusFilter,
                    onChange: setSprintStatusFilter,
                    options: allOf([
                      { value: "planning", label: "Planning" },
                      { value: "active", label: "Active" },
                      { value: "review", label: "Review" },
                      { value: "done", label: "Done" },
                    ]),
                  },
                ]}
                summary={`${filteredSprints.length} of ${componentSprints.length}`}
              />
              {filteredSprints.length === 0 ? (
                <EmptyState>No sprints match the filters.</EmptyState>
              ) : (
                <DataTable
                  headers={[
                    "Sprint",
                    "Goal",
                    "Status",
                    "Committed",
                    "Completed",
                    "",
                  ]}
                >
                  {filteredSprints.map((sprint) => (
                    <tr key={sprint.id} className="group">
                      <td className="py-4 pr-6">
                        <Link
                          href={`${base}/sprints/${sprint.id}/board`}
                          className="font-medium text-ink hover:underline"
                        >
                          Sprint {String(sprint.number).padStart(2, "0")}
                        </Link>
                        <div className="text-xs text-muted">{sprint.name}</div>
                      </td>
                      <td className="max-w-xs py-4 pr-6 text-muted">
                        {sprint.goal}
                      </td>
                      <td className="py-4 pr-6">
                        <StatusPill status={sprint.status} />
                      </td>
                      <td className="py-4 pr-6 tabular-nums">
                        {sprint.committed} pts
                      </td>
                      <td className="py-4 pr-6 tabular-nums">
                        {sprint.completed} pts
                      </td>
                      <td className="py-4 text-right">
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
                              showToast("Sprint removed.", "info");
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </DataTable>
              )}
            </>
          )}
        </div>
      </section>

      {/* Backlog tagged to this component */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h3 className="label">Backlog — this component</h3>
          <Link
            href={`${base}/backlog`}
            className="text-xs text-muted hover:text-ink"
          >
            Refine backlog →
          </Link>
        </div>
        <div className="mt-4">
          {componentBacklog.length === 0 ? (
            <EmptyState>
              No backlog items tagged to this component yet. Add them from the
              Backlog tab.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {componentBacklog.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">
                      {item.title}
                    </div>
                    <div className="text-xs text-muted">
                      {item.type} · {item.estimate} pts
                    </div>
                  </div>
                  <StatusPill
                    status={item.readiness}
                    label={readinessLabel[item.readiness]}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
