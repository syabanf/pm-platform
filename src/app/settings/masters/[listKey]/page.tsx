"use client";

import { use } from "react";
import Link from "next/link";
import { Breadcrumb } from "@/components/Breadcrumb";
import { MasterListEditor } from "@/components/MasterListEditor";
import { SectionHeader } from "@/components/ui";
import { masterListMeta, type MasterListKey } from "@/lib/data";

const isMasterListKey = (value: string): value is MasterListKey =>
  Object.prototype.hasOwnProperty.call(masterListMeta, value);

export default function MasterListPage({
  params,
}: {
  params: Promise<{ listKey: string }>;
}) {
  const { listKey } = use(params);

  if (!isMasterListKey(listKey)) {
    return (
      <div className="text-sm text-muted">
        No master list called “{listKey}”.{" "}
        <Link href="/settings/masters" className="text-ink underline">
          Back to master data
        </Link>
      </div>
    );
  }

  const meta = masterListMeta[listKey];

  return (
    <div>
      <Breadcrumb
        crumbs={[
          { label: "Master Data", href: "/settings/masters" },
          { label: meta.title },
        ]}
      />
      <div className="mt-6">
        <SectionHeader title={meta.title} description={meta.hint} />
        <p className="mt-1 text-xs text-muted">Used by {meta.usedBy}.</p>
      </div>
      <div className="mt-8 max-w-xl">
        <MasterListEditor listKey={listKey} />
      </div>
    </div>
  );
}
