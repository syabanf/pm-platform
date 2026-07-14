"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { AIBadge } from "@/components/AICoachPanel";
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
import { projectPath } from "@/lib/data";
import { newId, usePrototype } from "@/lib/store";

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const {
    clients,
    projects,
    products,
    decisions,
    projectsCrud,
    removeProjectCascade,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", objective: "" });

  const client = clients.find((c) => c.id === clientId);
  if (!client) {
    return (
      <PageContainer className="text-sm text-muted">
        Client not found — it may have been removed in this session.{" "}
        <Link href="/clients" className="text-ink underline">
          Back to clients
        </Link>
      </PageContainer>
    );
  }

  const clientProjects = projects.filter((p) => p.clientId === client.id);
  const clientProducts = products.filter((p) => p.clientId === client.id);
  const atRisk = clientProducts.filter((p) => p.risk !== "low").length;
  const activeSprints = clientProducts.filter((p) => p.currentSprintId).length;
  const clientProductIds = new Set(clientProducts.map((p) => p.id));
  const openDecisions = decisions.filter(
    (d) => d.status === "open" && clientProductIds.has(d.productId)
  ).length;

  const createProject = () => {
    if (!draft.name.trim()) {
      showToast("Project name is required.", "warning");
      return;
    }
    projectsCrud.add({
      id: newId("project"),
      clientId: client.id,
      name: draft.name.trim(),
      objective: draft.objective.trim() || "Objective to be defined.",
      status: "discovery",
    });
    setDraft({ name: "", objective: "" });
    setPanelOpen(false);
    showToast("Project created. Add a module to start delivery.", "success");
  };

  return (
    <PageContainer>
      <Breadcrumb
        crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]}
      />
      <div className="mt-6">
        <PageHeader
          eyebrow="Client"
          title={client.name}
          description={
            <>
              {client.industry} · {client.contractType} · WIT Owner:{" "}
              {client.witOwner}
            </>
          }
          actions={<StatusPill status={client.health} />}
        />
      </div>

      <KpiStrip
        className="mt-10"
        items={[
          { value: clientProjects.length, label: "Projects" },
          {
            value: atRisk,
            label: "Modules At Risk",
            tone: atRisk > 0 ? "warning" : "neutral",
          },
          { value: activeSprints, label: "Active Sprints" },
          { value: openDecisions, label: "Open Decisions" },
        ]}
      />

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="label">Projects — drill down</h2>
          <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            Add Project
          </Button>
        </div>

        {panelOpen && (
          <Panel className="mt-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Project Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Warehouse Digitalization"
                />
              </Field>
              <Field label="Objective">
                <input
                  value={draft.objective}
                  onChange={(e) =>
                    setDraft({ ...draft, objective: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={createProject}>Create Project</Button>
              <Button variant="secondary" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        )}

        <div className="mt-4">
          {clientProjects.length === 0 ? (
            <EmptyState>
              No projects yet. Add the first project for {client.name}.
            </EmptyState>
          ) : (
            <DataTable
              headers={["Project", "Status", "Modules", "At Risk", ""]}
            >
              {clientProjects.map((project) => {
                const projProducts = products.filter(
                  (p) => p.projectId === project.id
                );
                const projAtRisk = projProducts.filter((p) => p.risk !== "low");
                return (
                  <tr key={project.id} className="group">
                    <td className="py-4 pr-6">
                      <Link
                        href={projectPath(project)}
                        className="font-medium text-ink hover:underline"
                      >
                        {project.name}
                      </Link>
                      <div className="text-xs text-muted">
                        {project.objective}
                      </div>
                    </td>
                    <td className="py-4 pr-6">
                      <StatusPill status={project.status} />
                    </td>
                    <td className="py-4 pr-6 tabular-nums">
                      {projProducts.length}
                    </td>
                    <td
                      className={`py-4 pr-6 tabular-nums ${projAtRisk.length > 0 ? "text-warning" : "text-muted"}`}
                    >
                      {projAtRisk.length}
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <ConfirmButton
                          onConfirm={() => {
                            removeProjectCascade(project.id);
                            showToast(
                              `${project.name} and its modules were removed.`,
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

      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="label">Client Action Needed</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {client.actionNeeded.length === 0 && (
              <li className="py-4 text-sm text-muted">
                No pending client actions.
              </li>
            )}
            {client.actionNeeded.map((action) => (
              <li key={action} className="flex items-center gap-3 py-4">
                <span className="h-1.5 w-1.5 bg-warning" />
                <span className="text-sm text-ink">{action}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="label">AI Client Insight</h2>
          <div className="mt-4 border border-line border-l-2 border-l-ai p-5">
            <AIBadge />
            <p className="mt-3 text-sm text-ink">{client.aiInsight}</p>
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
