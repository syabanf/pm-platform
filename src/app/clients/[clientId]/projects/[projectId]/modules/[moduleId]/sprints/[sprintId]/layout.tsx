"use client";

import { use } from "react";
import Link from "next/link";
import { PageTabs, type Tab } from "@/components/PageTabs";
import { SwipeTabs } from "@/components/SwipeTabs";
import { StatusPill } from "@/components/StatusPill";
import { usePrototype, useSprint } from "@/lib/store";

export default function SprintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{
    clientId: string;
    projectId: string;
    moduleId: string;
    sprintId: string;
  }>;
}) {
  const { clientId, projectId, moduleId, sprintId } = use(params);
  const sprint = useSprint(sprintId);
  const { modules } = usePrototype();

  if (!sprint || sprint.moduleId !== moduleId) {
    return (
      <div className="text-sm text-muted">
        Sprint not found — it may have been removed in this session.{" "}
        <Link href="/clients" className="text-ink underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const base = `/clients/${clientId}/projects/${projectId}/modules/${moduleId}/sprints/${sprintId}`;
  const mod = modules.find((p) => p.id === moduleId);
  const component = mod?.components.find((m) => m.id === sprint.componentId);

  // Shared between the tab bar and the swipe-between-tabs gesture.
  const tabs: Tab[] = [
    { label: "Planning", href: `${base}/planning` },
    { label: "Board", href: `${base}/board` },
    { label: "Daily", href: `${base}/daily` },
    { label: "Charts", href: `${base}/burndown` },
    { label: "Review", href: `${base}/review` },
    { label: "Retro", href: `${base}/retro` },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border border-black p-5">
        <div>
          <div className="label">
            Sprint {String(sprint.number).padStart(2, "0")} — Sprint Goal
            {component ? ` · ${component.name}` : ""}
          </div>
          <p className="mt-1 text-base font-medium text-ink">{sprint.goal}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs tabular-nums text-muted">
            {sprint.daysLeft > 0 ? `${sprint.daysLeft} days left` : "Completed"}
          </span>
          <StatusPill status={sprint.status} />
        </div>
      </div>

      <div className="mt-6">
        <PageTabs tabs={tabs} />
      </div>
      <SwipeTabs tabs={tabs} className="mt-8">
        {children}
      </SwipeTabs>
    </div>
  );
}
