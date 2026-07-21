"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { RiskMatrix } from "@/components/RiskMatrix";
import { AIInsightBlock, AICoachSlideOver } from "@/components/AICoachPanel";
import { PageContainer, PageHeader, KpiStrip } from "@/components/ui";
import {
  clientPath,
  homeInsight,
  productPath,
  productPathById,
  projectPath,
  retroData,
  sprintPath,
  velocityInsight,
} from "@/lib/data";
import { usePrototype } from "@/lib/store";

const TODAY = "2026-07-08";

interface TriageItem {
  severity: number; // higher = more urgent
  kind: string;
  title: string;
  detail: string;
  href: string;
}

export default function HomePage() {
  const {
    currentUser,
    clients,
    projects,
    products,
    sprints,
    tasks,
    members,
    decisions,
    recentPaths,
    reportQueue,
  } = usePrototype();
  const atRiskProducts = products.filter((p) => p.risk !== "low").length;
  const firstName = currentUser?.name.split(" ")[0] ?? "there";

  // Portfolio tree: collapsed by default except the first client, so the page
  // opens calm and you expand only what you want (progressive disclosure).
  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    () => new Set(clients[0] ? [clients[0].id] : [])
  );
  const toggleClient = (id: string) =>
    setExpandedClients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---- triage: what needs the PM right now ----
  const triage: TriageItem[] = [];
  tasks
    .filter((t) => t.column === "blocked")
    .forEach((task) => {
      const sprint = sprints.find((s) => s.id === task.sprintId);
      if (!sprint) return;
      triage.push({
        severity: 100 + (task.blockedDays ?? 0),
        kind: "Blocked",
        title: task.title,
        detail: `${task.blockedReason ?? "Blocked"}${task.blockedDays ? ` · open ${task.blockedDays} days` : ""}`,
        href: `${sprintPath(sprint)}/board`,
      });
    });
  retroData.actions
    .filter((a) => a.status === "open" && a.due < TODAY)
    .forEach((action) => {
      triage.push({
        severity: 80,
        kind: "Overdue action",
        title: action.action,
        detail: `${action.owner} · due ${action.due}`,
        href: `${productPathById("oee-intelligence")}/sprints/sprint-03/retro`,
      });
    });
  members
    .filter((m) => m.workload > 100)
    .forEach((member) => {
      triage.push({
        severity: 70,
        kind: "Overloaded",
        title: `${member.name} is at ${member.workload}% workload`,
        detail: member.roleLabel,
        href: `${productPathById("oee-intelligence")}/members`,
      });
    });
  decisions
    .filter((d) => d.status === "open")
    .forEach((decision) => {
      triage.push({
        severity: 60,
        kind: "Decision",
        title: decision.title,
        detail: `Owner: ${decision.owner}`,
        href: `${productPathById(decision.productId)}/decisions`,
      });
    });
  triage.sort((a, b) => b.severity - a.severity);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Workspace"
        title={`Good morning, ${firstName}.`}
        description={
          triage.length > 0
            ? `${triage.length} things need your attention.`
            : "Nothing is stuck. Enjoy it while it lasts."
        }
      />

      {/* 1. Triage — what needs me */}
      <section id="triage" className="mt-8 scroll-mt-8">
        <h2 className="label">Needs Your Attention</h2>
        <ul className="animate-stagger mt-3 divide-y divide-line border-y border-line">
          {triage.slice(0, 6).map((item) => (
            <li key={`${item.kind}:${item.title}`}>
              <Link
                href={item.href}
                className="group flex items-center gap-4 py-3.5 hover:bg-soft"
              >
                <span className="w-28 shrink-0">
                  <StatusPill
                    status={
                      item.kind === "Blocked"
                        ? "blocked"
                        : item.kind === "Overdue action"
                          ? "at-risk"
                          : item.kind === "Overloaded"
                            ? "overloaded"
                            : "open"
                    }
                    label={item.kind}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink group-hover:underline">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {item.detail}
                  </span>
                </span>
                <span className="hidden shrink-0 text-xs text-muted group-hover:text-ink sm:inline">
                  Go →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 2. KPI row */}
      <KpiStrip
        className="mt-10"
        items={[
          { value: clients.length, label: "Active Clients" },
          { value: products.length, label: "Active Modules" },
          { value: atRiskProducts, label: "At Risk Modules", tone: "warning" },
          {
            value: reportQueue.filter((r) => r.status !== "done").length,
            label: "Reports Due",
          },
        ]}
      />

      {/* Jump back in */}
      {recentPaths.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="label">Jump back in</span>
          {recentPaths.map((recent) => (
            <Link
              key={recent.path}
              href={recent.path}
              className="border border-line px-3 py-1.5 text-xs text-ink hover:border-black"
            >
              {recent.label}
            </Link>
          ))}
        </div>
      )}

      {/* 3. Portfolio tree */}
      <section id="portfolio" className="mt-12 scroll-mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="label">Portfolio — Clients / Projects / Modules</h2>
          <Link href="/clients" className="text-xs text-muted hover:text-ink">
            All clients →
          </Link>
        </div>
        <div className="animate-stagger mt-4 border-y border-line">
          {clients.map((client) => {
            const clientProjects = projects.filter(
              (p) => p.clientId === client.id
            );
            const clientProducts = products.filter(
              (p) => p.clientId === client.id
            );
            const isOpen = expandedClients.has(client.id);
            const regionId = `portfolio-${client.id}`;
            return (
              <div key={client.id} className="border-b border-line last:border-b-0">
                <div className="flex items-center gap-2 bg-soft px-3 py-3">
                  <button
                    onClick={() => toggleClient(client.id)}
                    aria-expanded={isOpen}
                    aria-controls={regionId}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${client.name}`}
                    className="flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:text-ink"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                    >
                      <path d="M6 4l4 4-4 4" />
                    </svg>
                  </button>
                  <Link
                    href={clientPath(client.id)}
                    className="text-sm font-semibold text-ink hover:underline"
                  >
                    {client.name}
                  </Link>
                  <span className="hidden text-xs text-muted md:inline">
                    {client.industry}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="hidden text-xs tabular-nums text-muted sm:inline">
                      {clientProducts.length} modules
                    </span>
                    <span className="hidden sm:inline-flex">
                      <StatusPill status={client.health} />
                    </span>
                    <StatusPill status={client.risk} label={`${client.risk} risk`} />
                  </span>
                </div>
                <div id={regionId} className="animate-collapse" data-open={isOpen}>
                <div>
                <div className="border-t border-line">
                {clientProjects.map((project) => {
                  const projProducts = products.filter(
                    (p) => p.projectId === project.id
                  );
                  return (
                    <div key={project.id}>
                      <Link
                        href={projectPath(project)}
                        className="group flex items-center gap-3 border-b border-line px-4 py-2.5 pl-10 hover:bg-soft"
                      >
                        <span className="text-line">└</span>
                        <span className="text-sm font-medium text-ink group-hover:underline">
                          {project.name}
                        </span>
                        <span className="ml-auto flex items-center gap-3">
                          <span className="hidden text-xs tabular-nums text-muted sm:inline">
                            {projProducts.length} modules
                          </span>
                          <StatusPill status={project.status} />
                        </span>
                      </Link>
                      {projProducts.map((product) => {
                        const sprint = product.currentSprintId
                          ? sprints.find((s) => s.id === product.currentSprintId)
                          : undefined;
                        return (
                          <Link
                            key={product.id}
                            href={productPath(product)}
                            className="group flex items-center gap-3 border-b border-line px-4 py-2 pl-16 last:border-b-0 hover:bg-soft"
                          >
                            <span className="text-line">└</span>
                            <span className="text-sm text-ink group-hover:underline">
                              {product.name}
                            </span>
                            {sprint && (
                              <span className="hidden text-xs text-muted sm:inline">
                                · Sprint {String(sprint.number).padStart(2, "0")}
                              </span>
                            )}
                            <span className="ml-auto flex items-center gap-3">
                              <span className="hidden text-xs tabular-nums text-muted sm:inline">
                                {product.health}%
                              </span>
                              <StatusPill
                                status={
                                  product.blockedCount > 1 ? "blocked" : product.risk
                                }
                                label={
                                  product.blockedCount > 1
                                    ? "blocked"
                                    : `${product.risk} risk`
                                }
                              />
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
                </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Risk matrix */}
      <section className="mt-12">
        <h2 className="label">Portfolio Risk Matrix</h2>
        <div className="mt-4">
          <RiskMatrix />
        </div>
      </section>

      {/* 5. AI insight */}
      <section id="insight" className="mt-12 scroll-mt-8 max-w-xl">
        <h2 className="label">AI Delivery Insight</h2>
        <div className="mt-4">
          <AIInsightBlock insight={homeInsight} />
        </div>
      </section>

      <AICoachSlideOver insights={[homeInsight, velocityInsight]} />
    </PageContainer>
  );
}
