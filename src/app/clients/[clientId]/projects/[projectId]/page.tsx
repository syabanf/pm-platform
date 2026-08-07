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
import { clientPath, productPath } from "@/lib/data";
import { blockedCountFor, newId, usePrototype } from "@/lib/store";
import type { Product } from "@/lib/types";

type ProductDraft = {
  name: string;
  goal: string;
  owner: string;
  deliveryLead: string;
  status: Product["status"];
};

const emptyDraft: ProductDraft = {
  name: "",
  goal: "",
  owner: "",
  deliveryLead: "",
  status: "discovery",
};

const statusOptions: { value: Product["status"]; label: string }[] = [
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
    products,
    sprints,
    tasks,
    viewPrefs,
    setViewPref,
    productsCrud,
    removeProductCascade,
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

  const projectProducts = products.filter((p) => p.projectId === project.id);
  const atRisk = projectProducts.filter((p) => p.risk !== "low").length;
  const activeSprints = projectProducts.filter((p) => p.currentSprintId).length;
  const view = viewPrefs.projectModules;

  // Summed from live task status; products.blockedCount is a seed nothing maintains.
  const blocked = projectProducts.reduce(
    (sum, p) => sum + blockedCountFor(sprints, tasks, p.id),
    0
  );

  const filteredProducts = projectProducts.filter(
    (p) =>
      (statusFilter === "all" || p.status === statusFilter) &&
      (riskFilter === "all" || p.risk === riskFilter)
  );
  // The timeline draws the sprints of whichever modules survive the filters, so
  // narrowing to "at risk" narrows the chart with it. Every row has to say
  // which module it belongs to: sprint numbers only count within one module,
  // so a project timeline can hold several "Sprint 01".
  const filteredProductIds = new Set(filteredProducts.map((p) => p.id));
  const timelineSprints = sprints.filter((s) => filteredProductIds.has(s.productId));
  const productOf = (s: { productId: string }) =>
    projectProducts.find((p) => p.id === s.productId)!;
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

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      goal: product.goal,
      owner: product.owner,
      deliveryLead: product.deliveryLead,
      status: product.status,
    });
    setPanelOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Module name is required.", "warning");
      return;
    }
    if (editingId) {
      productsCrud.update(editingId, {
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
    productsCrud.add({
      id: newId("product"),
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
      modules: [],
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
          { value: projectProducts.length, label: "Modules" },
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
              Add Module
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
                          status: e.target.value as Product["status"],
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
          {projectProducts.length === 0 ? (
            <EmptyState>
              No modules yet. Add the first module for this project.
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
                summary={`${filteredProducts.length} of ${projectProducts.length}`}
              />
              {filteredProducts.length === 0 ? (
                <EmptyState>No modules match the current filters.</EmptyState>
              ) : view !== "list" ? (
                timelineSprints.length === 0 ? (
                  <EmptyState>
                    These modules have no sprints yet. Open a module and add one
                    from its Components tab.
                  </EmptyState>
                ) : view === "gantt" ? (
                  <SprintGantt
                    sprints={timelineSprints}
                    hrefFor={(s) =>
                      `${productPath(productOf(s))}/sprints/${s.id}/board`
                    }
                    labelFor={(s) => ({
                      title: productOf(s).name,
                      subtitle: `Sprint ${String(s.number).padStart(2, "0")} · ${s.name}`,
                    })}
                  />
                ) : (
                  <TaskCalendar
                    tasks={timelineTasks}
                    hrefFor={(t) =>
                      `${productPath(productOf(sprintOf(t)))}/sprints/${t.sprintId}/board`
                    }
                    contextFor={(t) => productOf(sprintOf(t)).name}
                  />
                )
              ) : (
                <DataTable
                  headers={["Module", "Status", "Health", "Velocity", "Current Sprint", "Risk", ""]}
                >
                  {filteredProducts.map((product) => {
                    const sprint = product.currentSprintId
                      ? sprints.find((s) => s.id === product.currentSprintId)
                      : undefined;
                    return (
                      <tr key={product.id} className="group">
                        <td className="py-4 pr-6">
                          <Link
                            href={productPath(product)}
                            className="font-medium text-ink hover:underline"
                          >
                            {product.name}
                          </Link>
                          <div className="text-xs text-muted">{product.goal}</div>
                        </td>
                        <td className="py-4 pr-6">
                          <StatusPill status={product.status} />
                        </td>
                        <td className="py-4 pr-6 tabular-nums">{product.health}%</td>
                        <td className="py-4 pr-6 tabular-nums">
                          {product.velocity || "—"}
                        </td>
                        <td className="py-4 pr-6 text-muted">
                          {sprint
                            ? `Sprint ${String(sprint.number).padStart(2, "0")}`
                            : "—"}
                        </td>
                        <td className="py-4 pr-6">
                          <StatusPill status={product.risk} />
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              onClick={() => openEdit(product)}
                              className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                            >
                              Edit
                            </button>
                            <ConfirmButton
                              onConfirm={() => {
                                removeProductCascade(product.id);
                                showToast(
                                  `${product.name} and its backlog were removed.`,
                                  "info"
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
