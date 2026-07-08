"use client";

import { use } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { AIInsightBlock, AICoachSlideOver } from "@/components/AICoachPanel";
import { EmptyState, KpiStrip } from "@/components/ui";
import { getSprint, sprintPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";

export default function ProductOverviewPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const { products } = usePrototype();
  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  const sprint = product.currentSprintId
    ? getSprint(product.currentSprintId)
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
              href={`${sprintPath(sprint)}/board`}
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
          { value: `${product.health}%`, label: "Product Health" },
          { value: product.velocity, label: "Velocity" },
          {
            value: product.blockedCount,
            label: "Blocked",
            tone: product.blockedCount > 0 ? "danger" : "neutral",
          },
          {
            value:
              product.risk.charAt(0).toUpperCase() + product.risk.slice(1),
            label: "Risk",
            tone:
              product.risk === "high"
                ? "danger"
                : product.risk === "medium"
                  ? "warning"
                  : "success",
          },
        ]}
      />

      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h2 className="label">Modules</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {product.modules.length === 0 && (
              <li className="py-4 text-sm text-muted">
                No modules yet — add them from the Modules tab.
              </li>
            )}
            {product.modules.map((module) => (
              <li key={module.id} className="flex items-center justify-between py-4">
                <div>
                  <div className="text-sm font-medium text-ink">{module.name}</div>
                  <div className="text-xs text-muted">Owner: {module.owner}</div>
                </div>
                <StatusPill status={module.status} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="label">AI Product Insight</h2>
          <div className="mt-4">
            <AIInsightBlock insight={product.aiInsight} />
          </div>
        </div>
      </section>

      <AICoachSlideOver insights={[product.aiInsight]} />
    </div>
  );
}
