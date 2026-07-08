"use client";

import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { RiskMatrix } from "@/components/RiskMatrix";
import { AIInsightBlock, AICoachSlideOver } from "@/components/AICoachPanel";
import { PageContainer, PageHeader, KpiStrip } from "@/components/ui";
import {
  clientPath,
  getSprint,
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
    tasks,
    members,
    decisions,
    recentPaths,
  } = usePrototype();
  const atRiskProducts = products.filter((p) => p.risk !== "low").length;
  const firstName = currentUser?.name.split(" ")[0] ?? "there";

  // ---- triage: what needs the PM right now ----
  const triage: TriageItem[] = [];
  tasks
    .filter((t) => t.column === "blocked")
    .forEach((task) => {
      const sprint = getSprint(task.sprintId);
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
        href: `${productPathById("oee-intelligence")}/decisions`,
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
        <ul className="mt-3 divide-y divide-line border-y border-line">
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
          { value: products.length, label: "Active Products" },
          { value: atRiskProducts, label: "At Risk Products", tone: "warning" },
          { value: 2, label: "Reports Due" },
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
          <h2 className="label">Portfolio — Clients / Projects / Products</h2>
          <Link href="/clients" className="text-xs text-muted hover:text-ink">
            All clients →
          </Link>
        </div>
        <div className="mt-4 border-y border-line">
          {clients.map((client) => {
            const clientProjects = projects.filter(
              (p) => p.clientId === client.id
            );
            return (
              <div key={client.id} className="border-b border-line last:border-b-0">
                <Link
                  href={clientPath(client.id)}
                  className="group flex items-center gap-4 border-b border-line bg-soft px-4 py-3.5"
                >
                  <span className="text-sm font-semibold text-ink group-hover:underline">
                    {client.name}
                  </span>
                  <span className="hidden text-xs text-muted md:inline">
                    {client.industry}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    <span className="hidden sm:inline-flex">
                      <StatusPill status={client.health} />
                    </span>
                    <StatusPill status={client.risk} label={`${client.risk} risk`} />
                    <span className="hidden text-xs text-muted group-hover:text-ink md:inline">
                      View →
                    </span>
                  </span>
                </Link>
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
                            {projProducts.length} products
                          </span>
                          <StatusPill status={project.status} />
                        </span>
                      </Link>
                      {projProducts.map((product) => {
                        const sprint = product.currentSprintId
                          ? getSprint(product.currentSprintId)
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
