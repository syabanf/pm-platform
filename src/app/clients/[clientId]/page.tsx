"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { StatusPill } from "@/components/StatusPill";
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
  const openDecisions = decisions.filter((d) => d.status === "open").length;

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
    showToast("Project created. Add a product to start delivery.", "success");
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
            label: "Products At Risk",
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

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {clientProjects.length === 0 && (
            <EmptyState className="lg:col-span-2">
              No projects yet. Add the first project for {client.name}.
            </EmptyState>
          )}
          {clientProjects.map((project) => {
            const projProducts = products.filter(
              (p) => p.projectId === project.id
            );
            const projAtRisk = projProducts.filter((p) => p.risk !== "low");
            return (
              <div
                key={project.id}
                className="group relative border border-line p-6 transition-colors hover:border-black"
              >
                <Link href={projectPath(project)} className="block">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-base font-semibold text-ink group-hover:underline">
                        {project.name}
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {project.objective}
                      </p>
                    </div>
                    <StatusPill status={project.status} />
                  </div>
                  <div className="mt-5 flex items-center gap-6 border-t border-line pt-4 text-sm">
                    <span className="tabular-nums text-ink">
                      {projProducts.length}{" "}
                      <span className="text-muted">products</span>
                    </span>
                    <span
                      className={`tabular-nums ${projAtRisk.length > 0 ? "text-warning" : "text-muted"}`}
                    >
                      {projAtRisk.length} at risk
                    </span>
                    <span className="ml-auto text-xs text-muted group-hover:text-ink">
                      View →
                    </span>
                  </div>
                </Link>
                <div className="absolute bottom-4 right-20 opacity-0 transition-opacity group-hover:opacity-100">
                  <ConfirmButton
                    onConfirm={() => {
                      removeProjectCascade(project.id);
                      showToast(
                        `${project.name} and its products were removed.`,
                        "info"
                      );
                    }}
                  />
                </div>
              </div>
            );
          })}
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
