"use client";

import { use } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { AIInsightBlock, AICoachSlideOver } from "@/components/AICoachPanel";
import { EmptyState, KpiStrip } from "@/components/ui";
import { componentPath, modulePath } from "@/lib/data";
import { blockedCountFor, usePrototype } from "@/lib/store";

export default function ModuleOverviewPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = use(params);
  const { modules, sprints, tasks } = usePrototype();
  const mod = modules.find((p) => p.id === moduleId);
  // Counted from the board, not the seeded modules.blockedCount, which nothing updates.
  const blockedNow = blockedCountFor(sprints, tasks, moduleId);
  if (!mod) return null;
  const sprint = mod.currentSprintId
    ? sprints.find((s) => s.id === mod.currentSprintId)
    : undefined;

  return (
    <div>
      {sprint ? (
        <div className="border border-black p-6">
          <div className="label">
            Sprint Goal — Sprint {String(sprint.number).padStart(2, "0")}
          </div>
          <p className="mt-2 text-lg font-medium text-ink">{sprint.goal}</p>
          <div className="mt-3 flex gap-4 text-xs text-muted">
            <span>{sprint.name}</span>
            <span>·</span>
            <span>{sprint.daysLeft} days left</span>
            <Link
              href={`${modulePath(mod)}/sprints/${sprint.id}/board`}
              className="ml-auto font-medium text-ink hover:underline"
            >
              Open Sprint Board →
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState>
          No active sprint. Start one from the Sprints tab when the backlog is
          ready.
        </EmptyState>
      )}

      <KpiStrip
        className="mt-8"
        items={[
          { value: `${mod.health}%`, label: "Module Health" },
          { value: mod.velocity, label: "Velocity" },
          {
            value: blockedNow,
            label: "Blocked",
            tone: blockedNow > 0 ? "danger" : "neutral",
          },
          {
            value:
              mod.risk.charAt(0).toUpperCase() + mod.risk.slice(1),
            label: "Risk",
            tone:
              mod.risk === "high"
                ? "danger"
                : mod.risk === "medium"
                  ? "warning"
                  : "success",
          },
        ]}
      />

      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="label">Components</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {mod.components.length === 0 && (
              <li className="py-4 text-sm text-muted">
                No components yet — add them from the Components tab.
              </li>
            )}
            {mod.components.map((component) => (
              <li key={component.id} className="flex items-center justify-between py-4">
                <div>
                  <Link
                    href={componentPath(mod, component.id)}
                    className="text-sm font-medium text-ink hover:underline"
                  >
                    {component.name}
                  </Link>
                  <div className="text-xs text-muted">Owner: {component.owner}</div>
                </div>
                <StatusPill status={component.status} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="label">AI Component Insight</h2>
          <div className="mt-4">
            <AIInsightBlock insight={mod.aiInsight} />
          </div>
        </div>
      </section>

      <AICoachSlideOver insights={[mod.aiInsight]} />
    </div>
  );
}
