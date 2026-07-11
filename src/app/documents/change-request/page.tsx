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

export default function ChangeRequestPage() {
  const { masters, showToast } = usePrototype();
  const impactAreas = masters.impactAreas;
  const [productId, setProductId] = useState(products[0].id);
  const [title, setTitle] = useState("Add shift filter to OEE dashboard");
  const [requestedBy, setRequestedBy] = useState("Pak Hendra (Client PIC)");
  const [description, setDescription] = useState(
    "Operators need to filter OEE metrics per shift (morning, afternoon, night) so shift supervisors can compare performance and address shift-specific downtime patterns."
  );
  const [reason, setReason] = useState(
    "Requested during Sprint 03 review. Shift-level visibility is required for the plant's daily production meeting, which is the main adoption moment for the dashboard."
  );
  const [impacts, setImpacts] = useState<string[]>(["Scope", "Timeline"]);
  const [effort, setEffort] = useState("4");
  const [scheduleImpact, setScheduleImpact] = useState(
    "Fits Sprint 04 if one low-priority item moves out. No release date change."
  );
  const [generated, setGenerated] = useState(false);

  const product = products.find((p) => p.id === productId);
  const client = product ? getClient(product.clientId) : undefined;

  const toggleImpact = (area: string) =>
    setImpacts((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );

  const generate = () => {
    if (!title.trim() || !description.trim()) {
      showToast("Title and description are required.", "warning");
      return;
    }
    setGenerated(true);
    showToast("Change request drafted. Review before sending for approval.", "success");
  };

  return (
    <DocPageShell
      label="Documents / Change Request"
      title="Change Request"
      description="Log a scope change with its business reason and impact — the scope-change log the spec requires, in client-approvable form."
      form={
        <>
          <Field label="Module">
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
          <Field label="Change Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Requested By">
            <input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={inputClass} />
          </Field>
          <Field label="Business Reason">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={inputClass} />
          </Field>
          <Field label="Impact Areas">
            <div className="flex flex-wrap gap-1.5">
              {impactAreas.map((area) => (
                <ToggleButton
                  key={area}
                  active={impacts.includes(area)}
                  size="md"
                  onClick={() => toggleImpact(area)}
                >
                  {area}
                </ToggleButton>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Effort (mandays)">
              <input value={effort} onChange={(e) => setEffort(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <Field label="Schedule Impact">
            <textarea value={scheduleImpact} onChange={(e) => setScheduleImpact(e.target.value)} rows={2} className={inputClass} />
          </Field>
          <GenerateButton onClick={generate} label="Generate Change Request" />
        </>
      }
      document={
        generated && product ? (
          <DocumentArticle>
            <DocHeader
              docType="Change Request — CR-2026-007"
              date="2026-07-08"
              title={title}
              meta={[
                { label: "Client", value: client?.name ?? "—" },
                { label: "Product", value: product.name },
                { label: "Requested by", value: requestedBy },
                { label: "Prepared by", value: "Fahmi" },
                { label: "Status", value: "Awaiting approval" },
              ]}
            />

            <DocSection number={1} title="Change Description">
              <p>{description}</p>
            </DocSection>

            <DocSection number={2} title="Business Reason">
              <p>{reason}</p>
            </DocSection>

            <DocSection number={3} title="Impact Assessment">
              <table className="w-full max-w-md text-sm">
                <tbody className="divide-y divide-line">
                  {impactAreas.map((area) => (
                    <tr key={area}>
                      <td className="py-1.5 text-muted">{area}</td>
                      <td className="py-1.5 text-right">
                        {impacts.includes(area) ? (
                          <span className="font-medium text-warning">Impacted</span>
                        ) : (
                          <span className="text-muted">No impact</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 text-muted">Estimated Effort</td>
                    <td className="py-1.5 text-right tabular-nums">{effort || "—"} mandays</td>
                  </tr>
                </tbody>
              </table>
            </DocSection>

            <DocSection number={4} title="Schedule Impact">
              <p>{scheduleImpact}</p>
            </DocSection>

            <DocSection number={5} title="Approval">
              <div className="grid gap-6 md:grid-cols-2">
                {[
                  { role: "Client PIC", name: client?.clientPic ?? "—" },
                  { role: "WIT Delivery Lead", name: "Fahmi" },
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

            <AIFootnote text="This change adds effort inside Sprint 04 capacity only if one low-priority item moves out — flag the trade-off explicitly during approval." />
            <DocActions
              extra={[
                {
                  label: "Log as Scope Change",
                  toast: "Logged to the sprint scope-change log (prototype).",
                },
              ]}
            />
          </DocumentArticle>
        ) : (
          <DocEmptyState hint="Describe the change and its impact — the approval-ready document appears here." />
        )
      }
    />
  );
}
