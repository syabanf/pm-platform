"use client";

import { use } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageTabs } from "@/components/PageTabs";
import { clientPath, productPath, projectPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";

export default function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientId: string; projectId: string; productId: string }>;
}) {
  const { clientId, projectId, productId } = use(params);
  const { clients, projects, products } = usePrototype();

  const product = products.find((p) => p.id === productId);
  const client = clients.find((c) => c.id === clientId);
  const project = projects.find((p) => p.id === projectId);

  if (
    !product ||
    !client ||
    !project ||
    product.projectId !== projectId ||
    product.clientId !== clientId
  ) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12 text-sm text-muted">
        Product not found — it may have been removed in this session.{" "}
        <Link href="/clients" className="text-ink underline">
          Back to clients
        </Link>
      </div>
    );
  }

  const base = productPath(product);

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
      <Breadcrumb
        crumbs={[
          { label: "Clients", href: "/clients" },
          { label: client.name, href: clientPath(client.id) },
          { label: project.name, href: projectPath(project) },
          { label: product.name },
        ]}
      />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight md:text-3xl text-ink">
        {product.name}
      </h1>
      <p className="mt-1 text-sm text-muted">{product.goal}</p>

      <div className="mt-8">
        <PageTabs
          tabs={[
            { label: "Overview", href: base, exact: true },
            { label: "Members", href: `${base}/members` },
            { label: "Modules", href: `${base}/modules` },
            { label: "Backlog", href: `${base}/backlog` },
            { label: "Sprints", href: `${base}/sprints` },
            { label: "Reports", href: `${base}/reports` },
            { label: "Decision Log", href: `${base}/decisions` },
          ]}
        />
      </div>
      <div className="mt-10">{children}</div>
    </div>
  );
}
