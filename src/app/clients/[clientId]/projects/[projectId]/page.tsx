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
} from "@/components/ui";
import { clientPath, getSprint, productPath } from "@/lib/data";
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
    productsCrud,
    removeProductCascade,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", goal: "" });

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

  const createProduct = () => {
    if (!draft.name.trim()) {
      showToast("Product name is required.", "warning");
      return;
    }
    productsCrud.add({
      id: newId("product"),
      projectId: project.id,
      clientId: client.id,
      name: draft.name.trim(),
      goal: draft.goal.trim() || "Product goal to be defined.",
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
        insight: "New product — start by defining modules and initial backlog.",
        reason: "No delivery data exists yet.",
        recommendations: [
          "Add modules from the Modules tab",
          "Generate the initial backlog with AI refinement",
        ],
        confidence: "high",
      },
    });
    setDraft({ name: "", goal: "" });
    setPanelOpen(false);
    showToast("Product created. Define its modules next.", "success");
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
          { value: projectProducts.length, label: "Products" },
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
          <h2 className="label">Products — drill down</h2>
          <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            Add Product
          </Button>
        </div>

        {panelOpen && (
          <Panel className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Product Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Inventory Intelligence"
                />
              </Field>
              <Field label="Product Goal">
                <input
                  value={draft.goal}
                  onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={createProduct}>Create Product</Button>
              <Button variant="secondary" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        )}

        <div className="mt-4">
          {projectProducts.length === 0 ? (
            <EmptyState>
              No products yet. Add the first product for this project.
            </EmptyState>
          ) : (
            <DataTable
              headers={["Product", "Status", "Health", "Velocity", "Current Sprint", "Risk", ""]}
            >
              {projectProducts.map((product) => {
                const sprint = product.currentSprintId
                  ? getSprint(product.currentSprintId)
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
        </div>
      </section>
    </PageContainer>
  );
}
