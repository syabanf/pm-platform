"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { SprintGantt } from "@/components/SprintGantt";
import { TaskCalendar } from "@/components/TaskCalendar";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, inputClass } from "@/components/Document";
import {
  PageContainer,
  PageHeader,
  Panel,
  Button,
  EmptyState,
  KpiStrip,
  FilterBar,
  allOf,
} from "@/components/ui";
import { clientPath, modulePath } from "@/lib/data";
import { blockedCountFor, newId, usePrototype } from "@/lib/store";
import type { Module } from "@/lib/types";

type ModuleDraft = {
  name: string;
  goal: string;
  owner: string;
  deliveryLead: string;
  status: Module["status"];
};

const emptyDraft: ModuleDraft = {
  name: "",
  goal: "",
  owner: "",
  deliveryLead: "",
  status: "discovery",
};

const statusOptions: { value: Module["status"]; label: string }[] = [
  { value: "discovery", label: "Discovery" },
  { value: "development", label: "Development" },
  { value: "release", label: "Release" },
  { value: "maintenance", label: "Maintenance" },
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ clientId: string; projectId: string }>;
}) {
  const { clientId, projectId } = use(params);
  const {
    clients,
    projects,
    modules,
    sprints,
    tasks,
    viewPrefs,
    setViewPref,
    modulesCrud,
    removeModuleCascade,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const project = projects.find((p) => p.id === projectId);
  const client = clients.find((c) => c.id === clientId);
  if (!project || project.clientId !== clientId || !client) {
    return (
      <PageContainer className="text-sm text-muted">
        Project not found — it may have been removed in this session.{" "}
        <Link href="/clients" className="text-ink underline">
          Back to clients
        </Link>
      </PageContainer>
    );
  }

  const projectModules = modules.filter((p) => p.projectId === project.id);
  const atRisk = projectModules.filter((p) => p.risk !== "low").length;
  const activeSprints = projectModules.filter((p) => p.currentSprintId).length;
  const view = viewPrefs.projectModules;

  // Summed from live task status; modules.blockedCount is a seed nothing maintains.
  const blocked = projectModules.reduce(
    (sum, p) => sum + blockedCountFor(sprints, tasks, p.id),
    0
  );

  const filteredModules = projectModules.filter(
    (p) =>
      (statusFilter === "all" || p.status === statusFilter) &&
      (riskFilter === "all" || p.risk === riskFilter)
  );
  // The timeline draws the sprints of whichever components survive the filters, so
  // narrowing to "at risk" narrows the chart with it. Every row has to say
  // which component it belongs to: sprint numbers only count within one component,
  // so a project timeline can hold several "Sprint 01".
  const filteredModuleIds = new Set(filteredModules.map((p) => p.id));
  const timelineSprints = sprints.filter((s) => filteredModuleIds.has(s.moduleId));
  const moduleOf = (s: { moduleId: string }) =>
    projectModules.find((p) => p.id === s.moduleId)!;
  // The calendar plots tasks, not sprint boundaries: a sprint has two dates and
  // says nothing about the days between them.
  const timelineSprintIds = new Set(timelineSprints.map((s) => s.id));
  const timelineTasks = tasks.filter((t) => timelineSprintIds.has(t.sprintId));
  const sprintOf = (t: { sprintId: string }) =>
    sprints.find((s) => s.id === t.sprintId)!;

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  };

  const openEdit = (mod: Module) => {
    setEditingId(mod.id);
    setDraft({
      name: mod.name,
      goal: mod.goal,
      owner: mod.owner,
      deliveryLead: mod.deliveryLead,
      status: mod.status,
    });
    setPanelOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Module name is required.", "warning");
      return;
    }
    if (editingId) {
      modulesCrud.update(editingId, {
        name: draft.name.trim(),
        goal: draft.goal.trim() || "Module goal to be defined.",
        owner: draft.owner.trim(),
        deliveryLead: draft.deliveryLead.trim(),
        status: draft.status,
      });
      setDraft(emptyDraft);
      setEditingId(null);
      setPanelOpen(false);
      showToast("Module updated.", "success");
      return;
    }
    modulesCrud.add({
      id: newId("module"),
      projectId: project.id,
      clientId: client.id,
      name: draft.name.trim(),
      goal: draft.goal.trim() || "Module goal to be defined.",
      owner: client.clientPic,
      deliveryLead: "Fahmi",
      status: "discovery",
      health: 100,
      risk: "low",
      velocity: 0,
      blockedCount: 0,
      components: [],
      currentSprintId: undefined,
      aiInsight: {
        insight: "New module — start by defining components and initial backlog.",
        reason: "No delivery data exists yet.",
        recommendations: [
          "Add components from the Components tab",
          "Generate the initial backlog with AI refinement",
        ],
        confidence: "high",
      },
    });
    setDraft(emptyDraft);
    setPanelOpen(false);
    showToast("Module created. Define its components next.", "success");
  };

  return (
    <PageContainer>
      <Breadcrumb
        crumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: clientPath(client.id) },
          { label: project.name },
        ]}
      />
      <div className="mt-6">
        <PageHeader
          eyebrow="Project"
          title={project.name}
          description={project.objective}
          actions={<StatusPill status={project.status} />}
        />
      </div>

      <KpiStrip
        className="mt-10"
        items={[
          { value: projectModules.length, label: "Modules" },
          {
            value: atRisk,
            label: "At Risk",
            tone: atRisk > 0 ? "warning" : "neutral",
          },
          { value: activeSprints, label: "Active Sprints" },
          {
            value: blocked,
            label: "Blocked Items",
            tone: blocked > 0 ? "danger" : "neutral",
          },
        ]}
      />

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="label">
            {view === "list" ? "Modules — drill down" : "Modules — timeline"}
          </h2>
          <div className="flex items-center gap-3">
            <ViewSwitcher
              options={[
                { id: "list" as const, label: "List" },
                { id: "gantt" as const, label: "Gantt" },
                { id: "calendar" as const, label: "Calendar" },
              ]}
              value={view}
              onChange={(v) => setViewPref("projectModules", v)}
            />
            <Button
              size="sm"
              onClick={() => (panelOpen ? setPanelOpen(false) : openCreate())}
            >
              Add Component
            </Button>
          </div>
        </div>

        {panelOpen && (
          <Panel title={editingId ? "Edit Module" : undefined} className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Module Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Inventory Intelligence"
                />
              </Field>
              <Field label="Module Goal">
                <input
                  value={draft.goal}
                  onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
                  className={inputClass}
                />
              </Field>
              {editingId && (
                <>
                  <Field label="Owner">
                    <input
                      value={draft.owner}
                      onChange={(e) =>
                        setDraft({ ...draft, owner: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Delivery Lead">
                    <input
                      value={draft.deliveryLead}
                      onChange={(e) =>
                        setDraft({ ...draft, deliveryLead: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          status: e.target.value as Module["status"],
                        })
                      }
                      className={inputClass}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={save}>
                {editingId ? "Save Changes" : "Create Module"}
              </Button>
              <Button variant="secondary" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        )}

        <div className="mt-4">
          {projectModules.length === 0 ? (
            <EmptyState>
              No components yet. Add the first component for this project.
            </EmptyState>
          ) : (
            <>
              <FilterBar
                className="mb-4"
                groups={[
                  {
                    label: "Status",
                    value: statusFilter,
                    onChange: setStatusFilter,
                    options: allOf([
                      { value: "discovery", label: "Discovery" },
                      { value: "development", label: "Development" },
                      { value: "release", label: "Release" },
                      { value: "maintenance", label: "Maintenance" },
                    ]),
                  },
                  {
                    label: "Risk",
                    value: riskFilter,
                    onChange: setRiskFilter,
                    options: allOf([
                      { value: "low", label: "Low" },
                      { value: "medium", label: "Medium" },
                      { value: "high", label: "High" },
                    ]),
                  },
                ]}
                summary={`${filteredModules.length} of ${projectModules.length}`}
              />
              {filteredModules.length === 0 ? (
                <EmptyState>No components match the current filters.</EmptyState>
              ) : view !== "list" ? (
                timelineSprints.length === 0 ? (
                  <EmptyState>
                    These components have no sprints yet. Open a component and add one
                    from its Components tab.
                  </EmptyState>
                ) : view === "gantt" ? (
                  <SprintGantt
                    sprints={timelineSprints}
                    hrefFor={(s) =>
                      `${modulePath(moduleOf(s))}/sprints/${s.id}/board`
                    }
                    labelFor={(s) => ({
                      title: moduleOf(s).name,
                      subtitle: `Sprint ${String(s.number).padStart(2, "0")} · ${s.name}`,
                    })}
                  />
                ) : (
                  <TaskCalendar
                    tasks={timelineTasks}
                    hrefFor={(t) =>
                      `${modulePath(moduleOf(sprintOf(t)))}/sprints/${t.sprintId}/board`
                    }
                    contextFor={(t) => moduleOf(sprintOf(t)).name}
                  />
                )
              ) : (
                <DataTable
                  headers={["Module", "Status", "Health", "Velocity", "Current Sprint", "Risk", ""]}
                >
                  {filteredModules.map((mod) => {
                    const sprint = mod.currentSprintId
                      ? sprints.find((s) => s.id === mod.currentSprintId)
                      : undefined;
                    return (
                      <tr key={mod.id} className="group">
                        <td className="py-4 pr-6">
                          <Link
                            href={modulePath(mod)}
                            className="font-medium text-ink hover:underline"
                          >
                            {mod.name}
                          </Link>
                          <div className="text-xs text-muted">{mod.goal}</div>
                        </td>
                        <td className="py-4 pr-6">
                          <StatusPill status={mod.status} />
                        </td>
                        <td className="py-4 pr-6 tabular-nums">{mod.health}%</td>
                        <td className="py-4 pr-6 tabular-nums">
                          {mod.velocity || "—"}
                        </td>
                        <td className="py-4 pr-6 text-muted">
                          {sprint
                            ? `Sprint ${String(sprint.number).padStart(2, "0")}`
                            : "—"}
                        </td>
                        <td className="py-4 pr-6">
                          <StatusPill status={mod.risk} />
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(mod)}
                              className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                            >
                              Edit
                            </button>
                            <ConfirmButton
                              onConfirm={() => {
                                const undo = removeModuleCascade(mod.id);
                                showToast(
                                  `${mod.name} and its backlog were removed.`,
                                  "info",
                                  { label: "Undo", run: undo }
                                );
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </DataTable>
              )}
            </>
          )}
        </div>
      </section>
    </PageContainer>
  );
}
