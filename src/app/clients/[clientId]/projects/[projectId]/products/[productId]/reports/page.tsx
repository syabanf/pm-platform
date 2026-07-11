"use client";

import { use, useState } from "react";
import { ReportPreview } from "@/components/ReportPreview";
import { StatusPill } from "@/components/StatusPill";
import { articleToMarkdown, downloadFile, slugify } from "@/lib/export";
import { newId, usePrototype } from "@/lib/store";
import type { ReportConfig, ReportType } from "@/lib/types";
import {
  Button,
  EmptyState,
  SectionHeader,
  ToggleButton,
} from "@/components/ui";

const reportTypes: ReportType[] = [
  "Sprint Report",
  "Module Report",
  "Client Report",
  "Member Performance Report",
  "Risk Report",
];

const periods = ["Current Sprint", "Last Sprint", "Monthly", "Custom Date"];

export default function ReportsPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const {
    products,
    sprints: allSprints,
    reportTemplates,
    generatedReports,
    saveGeneratedReport,
    markReportSent,
    showToast,
  } = usePrototype();
  const product = products.find((p) => p.id === productId);
  const sprints = allSprints.filter((s) => s.productId === productId);

  const [type, setType] = useState<ReportType>("Module Report");
  const [template, setTemplate] = useState("Client Facing");
  const [period, setPeriod] = useState("Current Sprint");
  const [generated, setGenerated] = useState<ReportConfig | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  if (!product) return null;

  // Period resolution: "Last Sprint" uses the previous sprint's data.
  const activeSprint = sprints.find((s) => s.status === "active") ?? sprints[0];
  const previousSprint =
    sprints
      .filter((s) => s.number < (activeSprint?.number ?? 0))
      .sort((a, b) => b.number - a.number)[0] ?? activeSprint;
  const sprint =
    generated?.period === "Last Sprint" ? previousSprint : activeSprint;

  const history = generatedReports.filter((r) => r.productId === productId);
  const currentReport = history.find((r) => r.id === reportId);

  const generate = () => {
    const config = { type, template, period };
    setGenerated(config);
    const id = newId("report");
    setReportId(id);
    saveGeneratedReport({
      id,
      productId,
      config,
      date: "2026-07-08",
      status: "draft",
    });
    showToast("Your report is ready for review before export.", "success");
  };

  const reopen = (id: string) => {
    const report = generatedReports.find((r) => r.id === id);
    if (!report) return;
    setType(report.config.type as ReportType);
    setTemplate(report.config.template);
    setPeriod(report.config.period);
    setGenerated(report.config);
    setReportId(report.id);
    showToast("Report reopened from history.", "info");
  };

  return (
    <div>
      <SectionHeader
        title="Report Generator"
        description="Reports are generated from sprint data, backlog status, blockers, and decisions — then reviewed before export. Templates come from the Template Master."
      />

      <div className="mt-8 grid gap-8 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] lg:gap-12 print:block">
        {/* Config */}
        <div className="print-hide space-y-8">
          <div>
            <div className="label mb-2">Report Type</div>
            <div className="flex flex-col gap-1.5">
              {reportTypes.map((t) => (
                <ToggleButton key={t} active={type === t} size="md" onClick={() => setType(t)}>
                  {t}
                </ToggleButton>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Template</div>
            <div className="flex flex-col gap-1.5">
              {reportTemplates.map((t) => (
                <ToggleButton
                  key={t.id}
                  active={template === t.name}
                  size="md"
                  onClick={() => setTemplate(t.name)}
                >
                  {t.name}
                  <span className="block text-xs font-normal text-muted">
                    {t.audience}
                  </span>
                </ToggleButton>
              ))}
            </div>
          </div>
          <div>
            <div className="label mb-2">Period</div>
            <div className="flex flex-col gap-1.5">
              {periods.map((p) => (
                <ToggleButton key={p} active={period === p} size="md" onClick={() => setPeriod(p)}>
                  {p}
                </ToggleButton>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-6">
            <Button size="lg" onClick={generate}>
              Generate Report
            </Button>
            {generated && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const article = document.querySelector("article");
                    if (!article) return;
                    downloadFile(
                      `${slugify(`${product.name} ${generated.type}`)}.md`,
                      articleToMarkdown(article),
                      "text/markdown;charset=utf-8"
                    );
                    showToast("Markdown file downloaded.", "success");
                  }}
                >
                  Export Markdown
                </Button>
                <Button variant="secondary" onClick={() => window.print()}>
                  Export PDF (Print)
                </Button>
                {currentReport?.status !== "sent" ? (
                  <button
                    onClick={() => {
                      if (reportId) markReportSent(reportId);
                      showToast(
                        "Marked as sent — the matching queue item is completed.",
                        "success"
                      );
                    }}
                    className="border border-success px-4 py-2 text-sm font-medium text-success hover:bg-success hover:text-paper"
                  >
                    Mark as Sent
                  </button>
                ) : (
                  <p className="px-1 text-xs text-success">
                    Sent on {currentReport.date}.
                  </p>
                )}
              </>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="border-t border-line pt-6">
              <div className="label mb-2">History</div>
              <ul className="space-y-1.5">
                {history.map((report) => (
                  <li key={report.id}>
                    <button
                      onClick={() => reopen(report.id)}
                      className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-xs ${
                        report.id === reportId
                          ? "border-black"
                          : "border-line hover:border-black"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">
                          {report.config.type}
                        </span>
                        <span className="block truncate text-muted">
                          {report.config.template} · {report.date}
                        </span>
                      </span>
                      <StatusPill
                        status={report.status === "sent" ? "done" : "planning"}
                        label={report.status}
                      />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          {generated && sprint ? (
            <ReportPreview product={product} sprint={sprint} config={generated} />
          ) : (
            <EmptyState centered>
              Choose a report type, template, and period — then generate a
              draft for review.
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
