"use client";

import { useState } from "react";
import {
  AIFootnote,
  DocActions,
  DocEmptyState,
  DocHeader,
  DocPageShell,
  DocSection,
  DocumentArticle,
  Field,
  GenerateButton,
  inputClass,
} from "@/components/Document";
import { ToggleButton } from "@/components/ui";
import { getClient, products } from "@/lib/data";
import { usePrototype } from "@/lib/store";

type Result = "pass" | "fail" | "pending";

interface UatItem {
  scope: string;
  result: Result;
  note: string;
}

const initialItems: UatItem[] = [
  { scope: "Machine data preview table", result: "pass", note: "" },
  { scope: "Telemetry ingestion for Line 1 machines", result: "pass", note: "" },
  { scope: "OEE calculation vs manual baseline", result: "pass", note: "Matches within 0.5%" },
  { scope: "Dashboard real-time refresh", result: "fail", note: "Refresh stalls when a machine reconnects" },
  { scope: "Downtime categorization", result: "pending", note: "Waiting category confirmation" },
];

const resultStyle: Record<Result, string> = {
  pass: "text-success",
  fail: "text-danger",
  pending: "text-warning",
};

export default function UatSignoffPage() {
  const { showToast } = usePrototype();
  const [productId, setProductId] = useState(products[0].id);
  const [period, setPeriod] = useState("Sprint 03 — 29 June to 10 July 2026");
  const [items, setItems] = useState<UatItem[]>(initialItems);
  const [generated, setGenerated] = useState(false);

  const product = products.find((p) => p.id === productId);
  const client = product ? getClient(product.clientId) : undefined;

  const passed = items.filter((i) => i.result === "pass").length;
  const failed = items.filter((i) => i.result === "fail").length;
  const pending = items.filter((i) => i.result === "pending").length;
  const overall: "Accepted" | "Accepted with notes" | "Not accepted" =
    failed === 0 && pending === 0
      ? "Accepted"
      : failed === 0
        ? "Accepted with notes"
        : "Not accepted";

  const setResult = (index: number, result: Result) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, result } : it)));
  const setNote = (index: number, note: string) =>
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, note } : it)));

  return (
    <DocPageShell
      label="Documents / UAT Sign-off"
      title="UAT Sign-off"
      description="Record acceptance test results per scope item and produce the sign-off document — the acceptance record for the sprint increment."
      form={
        <>
          <Field label="Product">
            <div className="flex flex-wrap gap-1.5">
              {products.slice(0, 4).map((p) => (
                <ToggleButton
                  key={p.id}
                  active={productId === p.id}
                  size="md"
                  onClick={() => setProductId(p.id)}
                >
                  {p.name}
                </ToggleButton>
              ))}
            </div>
          </Field>
          <Field label="Test Period">
            <input value={period} onChange={(e) => setPeriod(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Scope Items & Results">
            <ul className="divide-y divide-line border-y border-line">
              {items.map((item, i) => (
                <li key={item.scope} className="py-3">
                  <div className="text-sm text-ink">{item.scope}</div>
                  <div className="mt-2 flex gap-1.5">
                    {(["pass", "fail", "pending"] as const).map((r) => (
                      <button
                        key={r}
                        onClick={() => setResult(i, r)}
                        className={`border px-2.5 py-1 text-xs capitalize ${
                          item.result === r
                            ? `border-black font-medium ${resultStyle[r]}`
                            : "border-line text-muted hover:border-black"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  {item.result !== "pass" && (
                    <input
                      value={item.note}
                      onChange={(e) => setNote(i, e.target.value)}
                      placeholder="Note / reason"
                      className={`${inputClass} mt-2 text-xs`}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Field>
          <GenerateButton
            onClick={() => {
              setGenerated(true);
              showToast("UAT sign-off drafted.", "success");
            }}
            label="Generate Sign-off"
          />
        </>
      }
      document={
        generated && product ? (
          <DocumentArticle>
            <DocHeader
              docType="UAT Sign-off"
              date="2026-07-08"
              title={`${product.name} — User Acceptance Test`}
              meta={[
                { label: "Client", value: client?.name ?? "—" },
                { label: "Period", value: period },
                { label: "Prepared by", value: "Fahmi" },
                { label: "Overall Result", value: overall },
              ]}
            />

            <DocSection number={1} title="Result Summary">
              <p>
                {passed} of {items.length} scope items passed
                {failed > 0 && `, ${failed} failed`}
                {pending > 0 && `, ${pending} pending`}. Overall result:{" "}
                <span
                  className={`font-semibold ${
                    overall === "Accepted"
                      ? "text-success"
                      : overall === "Accepted with notes"
                        ? "text-warning"
                        : "text-danger"
                  }`}
                >
                  {overall}
                </span>
                .
              </p>
            </DocSection>

            <DocSection number={2} title="Test Results">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black text-left">
                    <th className="label py-2 pr-4 font-medium">Scope Item</th>
                    <th className="label py-2 pr-4 font-medium">Result</th>
                    <th className="label py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {items.map((item) => (
                    <tr key={item.scope}>
                      <td className="py-2 pr-4">{item.scope}</td>
                      <td className={`py-2 pr-4 font-medium capitalize ${resultStyle[item.result]}`}>
                        {item.result}
                      </td>
                      <td className="py-2 text-muted">{item.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DocSection>

            <DocSection number={3} title="Acceptance Statement">
              <p>
                By signing below, {client?.name} confirms the scope items marked
                as passed are accepted as working increment.
                {failed > 0 &&
                  " Failed items will be fixed and re-tested in the next sprint."}
                {pending > 0 &&
                  " Pending items will be tested once their dependencies are resolved."}
              </p>
            </DocSection>

            <DocSection number={4} title="Sign-off">
              <div className="grid gap-6 md:grid-cols-2">
                {[
                  { role: "Client PIC", name: client?.clientPic ?? "—" },
                  { role: "WIT QA Engineer", name: "Christian" },
                ].map((signer) => (
                  <div key={signer.role} className="border border-line p-4">
                    <div className="label">{signer.role}</div>
                    <div className="mt-1 text-sm text-ink">{signer.name}</div>
                    <div className="mt-8 border-t border-line pt-2 text-xs text-muted">
                      Signature & date
                    </div>
                  </div>
                ))}
              </div>
            </DocSection>

            <AIFootnote
              text={
                failed > 0
                  ? "The failed refresh case is a reconnect edge case already logged as QA reopen — link it to the fix task before the client meeting."
                  : "All tested items passed. Attach this record to the sprint report."
              }
            />
            <DocActions />
          </DocumentArticle>
        ) : (
          <DocEmptyState hint="Mark each scope item pass/fail and generate the acceptance record." />
        )
      }
    />
  );
}
