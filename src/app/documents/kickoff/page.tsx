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
import { clients } from "@/lib/data";
import { usePrototype } from "@/lib/store";

const toLines = (raw: string) =>
  raw
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);

export default function KickoffCharterPage() {
  const { showToast } = usePrototype();
  const [clientId, setClientId] = useState(clients[0].id);
  const [title, setTitle] = useState("CMMS Integration — Project Kickoff");
  const [objective, setObjective] = useState(
    "Connect maintenance work orders with machine downtime data so maintenance planning is driven by actual machine behavior."
  );
  const [scopeIn, setScopeIn] = useState(
    `- CMMS work order sync (read)
- Downtime-to-work-order linking
- Maintenance dashboard`
  );
  const [scopeOut, setScopeOut] = useState(
    `- CMMS write-back / two-way sync
- Spare part inventory
- Mobile app`
  );
  const [team, setTeam] = useState(
    "Fahmi (Delivery Lead), Risya (SA), Aditiya (Backend), Christian (QA)"
  );
  const [timeline, setTimeline] = useState("20 July 2026 — 30 October 2026");
  const [criteria, setCriteria] = useState(
    `- Work orders visible against downtime events within 5 minutes
- Maintenance team uses the dashboard in weekly planning
- Zero manual data re-entry between systems`
  );
  const [generated, setGenerated] = useState(false);

  const client = clients.find((c) => c.id === clientId);

  return (
    <DocPageShell
      label="Documents / Kickoff Charter"
      title="Kickoff Charter"
      description="One page that aligns everyone before work starts: objective, what's in and out of scope, team, timeline, and how success is measured."
      form={
        <>
          <Field label="Client">
            <div className="flex flex-wrap gap-1.5">
              {clients.map((c) => (
                <ToggleButton
                  key={c.id}
                  active={clientId === c.id}
                  size="md"
                  onClick={() => setClientId(c.id)}
                >
                  {c.name}
                </ToggleButton>
              ))}
            </div>
          </Field>
          <Field label="Project / Product Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Objective">
            <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="In Scope (bullets)">
              <textarea value={scopeIn} onChange={(e) => setScopeIn(e.target.value)} rows={5} className={`${inputClass} font-mono text-xs`} />
            </Field>
            <Field label="Out of Scope (bullets)">
              <textarea value={scopeOut} onChange={(e) => setScopeOut(e.target.value)} rows={5} className={`${inputClass} font-mono text-xs`} />
            </Field>
          </div>
          <Field label="Team">
            <input value={team} onChange={(e) => setTeam(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Timeline">
            <input value={timeline} onChange={(e) => setTimeline(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Success Criteria (bullets)">
            <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={4} className={`${inputClass} font-mono text-xs`} />
          </Field>
          <GenerateButton
            onClick={() => {
              if (!objective.trim()) {
                showToast("An objective is required.", "warning");
                return;
              }
              setGenerated(true);
              showToast("Kickoff charter drafted.", "success");
            }}
            label="Generate Charter"
          />
        </>
      }
      document={
        generated ? (
          <DocumentArticle>
            <DocHeader
              docType="Kickoff Charter"
              date="2026-07-08"
              title={title}
              meta={[
                { label: "Client", value: client?.name ?? "—" },
                { label: "Timeline", value: timeline },
                { label: "Prepared by", value: "Fahmi" },
              ]}
            />

            <DocSection number={1} title="Objective">
              <p>{objective}</p>
            </DocSection>

            <DocSection number={2} title="Scope">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="label text-success">In Scope</div>
                  <ul className="mt-2 space-y-1">
                    {toLines(scopeIn).map((line) => (
                      <li key={line}>— {line}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="label text-danger">Out of Scope</div>
                  <ul className="mt-2 space-y-1">
                    {toLines(scopeOut).map((line) => (
                      <li key={line}>— {line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </DocSection>

            <DocSection number={3} title="Team">
              <p>{team}</p>
            </DocSection>

            <DocSection number={4} title="Timeline">
              <p>{timeline}</p>
            </DocSection>

            <DocSection number={5} title="Success Criteria">
              <ul className="space-y-1">
                {toLines(criteria).map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-success" />
                    {line}
                  </li>
                ))}
              </ul>
            </DocSection>

            <AIFootnote text="Out-of-scope items are the future change requests — walk the client through that list explicitly during kickoff." />
            <DocActions />
          </DocumentArticle>
        ) : (
          <DocEmptyState hint="Define objective, scope, team, and timeline — the one-page charter appears here." />
        )
      }
    />
  );
}
