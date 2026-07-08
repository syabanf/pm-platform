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
import { parseStatusUpdate, type ParsedUpdate } from "@/lib/parsers";
import { usePrototype } from "@/lib/store";

const SAMPLE_BULLETS = `- Finished machine data preview table, QA passed
- Completed OEE formula documentation, validated by client
- Dashboard UI still in progress, 60% done
- Telemetry API validation waiting for sample data from client
- Blocked: downtime categories not confirmed yet
- Need client PIC to assign downtime category owner
- Please provide sample machine data by 11 July
- Next week we will start downtime analysis screens`;

export default function StatusUpdatePage() {
  const { showToast } = usePrototype();
  const [productId, setProductId] = useState(products[0].id);
  const [period, setPeriod] = useState("Week of 6–10 July 2026");
  const [bullets, setBullets] = useState(SAMPLE_BULLETS);
  const [parsed, setParsed] = useState<ParsedUpdate | null>(null);

  const product = products.find((p) => p.id === productId);
  const client = product ? getClient(product.clientId) : undefined;

  const generate = () => {
    if (!bullets.trim()) {
      showToast("Add a few notes first.", "warning");
      return;
    }
    setParsed(parseStatusUpdate(bullets));
    showToast("Status update drafted.", "success");
  };

  return (
    <DocPageShell
      label="Documents / Status Update"
      title="Status Update"
      description="Turn quick notes into a structured weekly update: what's done, what's in flight, what's blocked, and what you need from the client."
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
          <Field label="Period">
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={bullets}
              onChange={(e) => setBullets(e.target.value)}
              rows={12}
              className={`${inputClass} font-mono text-xs leading-relaxed`}
              placeholder={"- What got finished\n- What is still moving\n- What is blocked\n- What you need from the client"}
            />
            <p className="mt-1.5 text-xs text-muted">
              Tip: &ldquo;finished/completed&rdquo; → done,
              &ldquo;blocked/waiting&rdquo; → blockers, &ldquo;need/please&rdquo;
              → asks.
            </p>
          </Field>
          <GenerateButton onClick={generate} label="Generate Update" />
        </>
      }
      document={
        parsed ? (
          <DocumentArticle>
            <DocHeader
              docType="Status Update"
              date="2026-07-08"
              title={`${product?.name} — Status Update`}
              meta={[
                { label: "Client", value: client?.name ?? "—" },
                { label: "Period", value: period },
                { label: "Prepared by", value: "Fahmi" },
              ]}
            />

            <DocSection number={1} title="Summary">
              <p>
                {parsed.done.length} items completed, {parsed.inFlight.length}{" "}
                in flight, {parsed.blockers.length} blocked.{" "}
                {parsed.asks.length > 0
                  ? `${parsed.asks.length} item${parsed.asks.length > 1 ? "s" : ""} need client action.`
                  : "No client action needed this period."}
              </p>
            </DocSection>

            <DocSection number={2} title="Completed">
              <ul className="space-y-1">
                {parsed.done.length === 0 && <li className="text-muted">—</li>}
                {parsed.done.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </DocSection>

            <DocSection number={3} title="In Flight">
              <ul className="space-y-1">
                {parsed.inFlight.length === 0 && <li className="text-muted">—</li>}
                {parsed.inFlight.map((item) => (
                  <li key={item}>— {item}</li>
                ))}
              </ul>
            </DocSection>

            <DocSection number={4} title="Blockers & Risks">
              <ul className="space-y-1">
                {parsed.blockers.length === 0 && (
                  <li className="text-muted">No blockers this period.</li>
                )}
                {parsed.blockers.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-danger" />
                    {item}
                  </li>
                ))}
              </ul>
            </DocSection>

            <DocSection number={5} title="Client Action Needed">
              <ul className="space-y-1">
                {parsed.asks.length === 0 && (
                  <li className="text-muted">Nothing needed right now.</li>
                )}
                {parsed.asks.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-warning" />
                    {item}
                  </li>
                ))}
              </ul>
            </DocSection>

            <AIFootnote
              text={`Sorted ${parsed.done.length + parsed.inFlight.length + parsed.blockers.length + parsed.asks.length} notes into completed, in flight, blockers, and client asks.`}
            />
            <DocActions />
          </DocumentArticle>
        ) : (
          <DocEmptyState hint="Type a few quick notes and generate a client-ready weekly update." />
        )
      }
    />
  );
}
