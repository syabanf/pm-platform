"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
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
import { newId, usePrototype } from "@/lib/store";

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
    productsCrud,
    removeProductCascade,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", goal: "" });
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
  const blocked = projectProducts.reduce((sum, p) => sum + p.blockedCount, 0);

  const filteredProducts = projectProducts.filter(
    (p) =>
      (statusFilter === "all" || p.status === statusFilter) &&
      (riskFilter === "all" || p.risk === riskFilter)
  );

  const createProduct = () => {
    if (!draft.name.trim()) {
      showToast("Module name is required.", "warning");
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
    setDraft({ name: "", goal: "" });
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
        <div className="flex items-center justify-between">
          <h2 className="label">Modules — drill down</h2>
          <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            Add Module
          </Button>
        </div>

        {panelOpen && (
          <Panel className="mt-4">
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
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={createProduct}>Create Module</Button>
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
