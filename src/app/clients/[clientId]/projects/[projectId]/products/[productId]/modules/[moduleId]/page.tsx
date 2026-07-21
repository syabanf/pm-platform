"use client";

import { use, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, inputClass } from "@/components/Document";
import {
  Button,
  EmptyState,
  FilterBar,
  KpiStrip,
  Panel,
  allOf,
} from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";
import type { Sprint } from "@/lib/types";

const sprintStatuses: Sprint["status"][] = [
  "planning",
  "active",
  "review",
  "done",
];

const emptyDraft = {
  name: "",
  goal: "",
  status: "planning" as Sprint["status"],
  startDate: "",
  endDate: "",
};

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
    productId: string;
    moduleId: string;
  }>;
}) {
  const { clientId, projectId, productId, moduleId } = use(params);
  const { products, sprints, backlog, sprintsCrud, showToast } = usePrototype();
  const base = `/clients/${clientId}/projects/${projectId}/products/${productId}`;

  const product = products.find((p) => p.id === productId);
  const component = product?.modules.find((m) => m.id === moduleId);

  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [sprintStatusFilter, setSprintStatusFilter] = useState("all");

  if (!product || !component) {
    return (
      <EmptyState>
        Component not found — it may have been removed in this session.{" "}
        <Link href={`${base}/modules`} className="text-ink underline">
          Back to Components
        </Link>
      </EmptyState>
    );
  }

  const componentSprints = sprints
    .filter((s) => s.productId === productId && s.moduleId === moduleId)
    .sort((a, b) => b.number - a.number);
  const filteredSprints = componentSprints.filter(
    (s) => sprintStatusFilter === "all" || s.status === sprintStatusFilter
  );
  const componentBacklog = backlog.filter(
    (b) => b.productId === productId && b.moduleId === moduleId
  );

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  };

  const openEdit = (sprint: Sprint) => {
    setEditingId(sprint.id);
    setDraft({
      name: sprint.name,
      goal: sprint.goal,
      status: sprint.status,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    });
    setPanelOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Sprint name is required.", "warning");
      return;
    }
    if (editingId) {
      sprintsCrud.update(editingId, {
        name: draft.name.trim(),
        goal: draft.goal.trim(),
        status: draft.status,
        startDate: draft.startDate,
        endDate: draft.endDate,
      });
      setPanelOpen(false);
      showToast("Sprint updated.", "success");
      return;
    }
    const nextNumber =
      sprints
        .filter((s) => s.productId === productId)
        .reduce((max, s) => Math.max(max, s.number), 0) + 1;
    // Real ISO dates so the sprint schedules on the Gantt/Calendar (a "TBD"
    // string parses to Invalid Date and collapses the whole Gantt to NaN).
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 13); // ~2 calendar weeks ≈ 10 working days
    sprintsCrud.add({
      id: newId("sprint"),
      productId,
      moduleId,
      number: nextNumber,
      name: draft.name.trim(),
      goal: draft.goal.trim() || "Sprint goal to be defined.",
      startDate: iso(start),
      endDate: iso(end),
      workingDays: 10,
      daysLeft: 10,
      status: "planning",
      members: [],
      backlogItemIds: [],
      committed: 0,
      completed: 0,
      progress: 0,
      risk: "low",
    });
    setDraft(emptyDraft);
    setPanelOpen(false);
    showToast(`Sprint added to ${component.name}. Plan it next.`, "success");
  };

  return (
    <div>
      {/* Component sub-header — the drill-down level below Module */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted">
            <Link href={`${base}/modules`} className="hover:text-ink">
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
          <Panel
            title={editingId ? "Edit Sprint" : undefined}
            className="animate-in mt-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Sprint Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Data Ingestion Hardening"
                />
              </Field>
              <Field label="Sprint Goal">
                <input
                  value={draft.goal}
                  onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
                  className={inputClass}
                />
              </Field>
              {editingId && (
                <>
                  <Field label="Status">
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          status: e.target.value as Sprint["status"],
                        })
                      }
                      className={inputClass}
                    >
                      {sprintStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Start Date">
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) =>
                        setDraft({ ...draft, startDate: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="End Date">
                    <input
                      type="date"
                      value={draft.endDate}
                      onChange={(e) =>
                        setDraft({ ...draft, endDate: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={save}>
                {editingId ? "Save Changes" : "Create Sprint"}
              </Button>
              <Button variant="secondary" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
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
                        <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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
