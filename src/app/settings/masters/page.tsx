"use client";

import { useState } from "react";
import Link from "next/link";
import { Folder } from "@/components/Folder";
import { DataTable } from "@/components/DataTable";
import { SectionHeader } from "@/components/ui";
import {
  masterListFeatures,
  masterListMeta,
  type MasterListKey,
} from "@/lib/data";
import { usePrototype } from "@/lib/store";

const keys = Object.keys(masterListMeta) as MasterListKey[];

export default function MasterDataPage() {
  const { masters } = usePrototype();
  // Every feature open on arrival: there are four, and the point of the page
  // is to show at a glance what exists to configure.
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const toggle = (feature: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(feature)) next.delete(feature);
      else next.add(feature);
      return next;
    });

  return (
    <div>
      <SectionHeader
        title="Master Data"
        description="The lookup values behind every form, grouped by the feature that uses them. Renaming a value rewrites every record that referenced it; removing one leaves existing records alone."
      />

      <div className="mt-8 space-y-3">
        {masterListFeatures.map((feature) => {
          const lists = keys.filter((k) => masterListMeta[k].feature === feature);
          if (lists.length === 0) return null;
          return (
            <Folder
              key={feature}
              label={feature}
              count={lists.length}
              open={!closed.has(feature)}
              onToggle={() => toggle(feature)}
            >
              <DataTable headers={["List", "Values", "Used by"]}>
                {lists.map((key) => {
                  const meta = masterListMeta[key];
                  return (
                    <tr key={key}>
                      <td className="py-4 pr-6">
                        <Link
                          href={`/settings/masters/${key}`}
                          className="font-medium text-ink hover:underline"
                        >
                          {meta.title}
                        </Link>
                        <div className="text-xs text-muted">{meta.hint}</div>
                      </td>
                      <td
                        className={`py-4 pr-6 tabular-nums ${
                          masters[key].length === 0 ? "text-warning" : ""
                        }`}
                      >
                        {masters[key].length}
                      </td>
                      <td className="py-4 text-muted">{meta.usedBy}</td>
                    </tr>
                  );
                })}
              </DataTable>
            </Folder>
          );
        })}
      </div>
    </div>
  );
}
