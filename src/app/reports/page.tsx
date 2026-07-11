"use client";

import { use, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, inputClass } from "@/components/Document";
import {
  Button,
  EmptyState,
  PageContainer,
  PageHeader,
  Panel,
} from "@/components/ui";
import { productPathById } from "@/lib/data";
import { newId, usePrototype } from "@/lib/store";

export default function GlobalReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = use(searchParams);
  const {
    products,
    clients,
    reportQueue,
    reportQueueCrud,
    reportTemplates,
    generatedReports,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({
    productId: products[0]?.id ?? "",
    type: "Sprint Report",
    template: reportTemplates[0]?.name ?? "Internal PM",
    due: "2026-07-15",
  });

  const filtered = type
    ? reportQueue.filter((r) => r.type === type)
    : reportQueue;

  const addToQueue = () => {
    const product = products.find((p) => p.id === draft.productId);
    if (!product) return;
    const client = clients.find((c) => c.id === product.clientId);
    reportQueueCrud.add({
      id: newId("rq"),
      title: `${product.name} — ${draft.type}`,
      productId: product.id,
      client: client?.name ?? "—",
      type: draft.type,
      template: draft.template,
      due: draft.due,
      status: "open",
    });
    setPanelOpen(false);
    showToast("Report added to the queue.", "success");
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow={`Reports${type ? ` / ${type}` : ""}`}
        title="Report Queue"
        description={
          type
            ? `${filtered.length} ${type.toLowerCase()}${filtered.length === 1 ? "" : "s"} in the queue.`
            : "Reports due across all clients. Generating and marking a report as sent completes its queue item."
        }
        actions={
          <div className="flex gap-2">
            <ExportCsvButton
              filename="report-queue.csv"
              headers={["Report", "Client", "Type", "Template", "Due", "Status"]}
              rows={filtered.map((r) => [
                r.title,
                r.client,
                r.type,
                r.template,
                r.due,
                r.status,
              ])}
            />
            <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
              Add to Queue
            </Button>
          </div>
        }
      />

      {panelOpen && (
        <Panel className="mt-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Module">
              <select
                value={draft.productId}
                onChange={(e) => setDraft({ ...draft, productId: e.target.value })}
                className={inputClass}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                className={inputClass}
              >
                {["Sprint Report", "Module Report", "Client Report", "Member Performance Report", "Risk Report"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Template">
              <select
                value={draft.template}
                onChange={(e) => setDraft({ ...draft, template: e.target.value })}
                className={inputClass}
              >
                {reportTemplates.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Due">
              <input
                value={draft.due}
                onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={addToQueue}>Add to Queue</Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <div className="mt-10">
        <DataTable headers={["Report", "Client", "Type", "Template", "Due", "Status", ""]}>
          {filtered.map((report) => (
            <tr key={report.id} className="group">
              <td className="py-4 pr-6 font-medium text-ink">{report.title}</td>
              <td className="py-4 pr-6 text-muted">{report.client}</td>
              <td className="py-4 pr-6 text-muted">{report.type}</td>
              <td className="py-4 pr-6 text-muted">{report.template}</td>
              <td className="py-4 pr-6 tabular-nums text-muted">{report.due}</td>
              <td className="py-4 pr-6">
                <StatusPill status={report.status} />
              </td>
              <td className="py-4 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`${productPathById(report.productId)}/reports`}
                    className="text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-ink"
                  >
                    Generate →
                  </Link>
                  <div className="opacity-0 transition-opacity group-hover:opacity-100">
                    <ConfirmButton
                      label="Remove"
                      onConfirm={() => {
                        reportQueueCrud.remove(report.id);
                        showToast("Removed from queue.", "info");
                      }}
                    />
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* History across all products */}
      <section className="mt-12">
        <h2 className="label">Generated This Session</h2>
        {generatedReports.length === 0 ? (
          <EmptyState className="mt-3">
            Nothing generated yet. Reports you generate appear here and can be
            reopened from the module&apos;s Reports tab.
          </EmptyState>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {generatedReports.map((report) => {
              const product = products.find((p) => p.id === report.productId);
              return (
                <li key={report.id} className="flex items-center gap-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {product?.name} — {report.config.type}
                    </span>
                    <span className="block text-xs text-muted">
                      {report.config.template} · {report.config.period} ·{" "}
                      {report.date}
                    </span>
                  </span>
                  <StatusPill
                    status={report.status === "sent" ? "done" : "planning"}
                    label={report.status}
                  />
                  <Link
                    href={`${productPathById(report.productId)}/reports`}
                    className="text-xs text-muted hover:text-ink"
                  >
                    Open →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
