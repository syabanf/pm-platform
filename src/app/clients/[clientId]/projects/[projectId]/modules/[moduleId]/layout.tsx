"use client";

import { use } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageTabs, type Tab } from "@/components/PageTabs";
import { SwipeTabs } from "@/components/SwipeTabs";
import { StatusPill } from "@/components/StatusPill";
import { PageHeader } from "@/components/ui";
import { clientPath, modulePath, projectPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";

export default function ModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string; projectId: string; moduleId: string }>;
}) {
  const { clientId, projectId, moduleId } = use(params);
  const { clients, projects, modules } = usePrototype();

  const mod = modules.find((p) => p.id === moduleId);
  const client = clients.find((c) => c.id === clientId);
  const project = projects.find((p) => p.id === projectId);

  if (
    !mod ||
    !client ||
    !project ||
    mod.projectId !== projectId ||
    mod.clientId !== clientId
  ) {
    return (
      <div className="mx-auto max-w-[88rem] px-5 py-8 md:px-10 md:py-12 text-sm text-muted">
        Component not found — it may have been removed in this session.{" "}
        <Link href="/clients" className="text-ink underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const base = modulePath(mod);

  // Jira project order: work first (Summary → Backlog → Board → Reports), then
  // taxonomy/config (Components → pages → people). Shared so the tab bar and
  // the swipe-between-tabs gesture stay in lockstep.
  const tabs: Tab[] = [
    { label: "Overview", href: base, exact: true },
    { label: "Backlog", href: `${base}/backlog` },
    { label: "Sprints", href: `${base}/sprints` },
    { label: "Reports", href: `${base}/reports` },
    { label: "Components", href: `${base}/components` },
    { label: "Decision Log", href: `${base}/decisions` },
    { label: "Members", href: `${base}/members` },
  ];

  return (
    <div className="mx-auto max-w-[88rem] px-5 py-8 md:px-10 md:py-12">
      <Breadcrumb
        crumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: clientPath(client.id) },
          { label: project.name, href: projectPath(project) },
          { label: mod.name },
        ]}
      />
      <div className="mt-6">
        <PageHeader
          eyebrow="Module"
          title={mod.name}
          description={mod.goal}
          actions={<StatusPill status={mod.status} />}
        />
      </div>

      <div className="mt-8">
        <PageTabs tabs={tabs} />
      </div>
      <SwipeTabs tabs={tabs} className="mt-10">
        {children}
      </SwipeTabs>
    </div>
  );
}
