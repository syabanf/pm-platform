"use client";

import { use, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field } from "@/components/Document";
import {
  allOf,
  Button,
  EmptyState,
  FilterBar,
  Input,
  Panel,
  SectionHeader,
} from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";

export default function DecisionLogPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const { decisions, decisionsCrud, showToast } = usePrototype();
  const productDecisions = decisions.filter((d) => d.productId === productId);
  const [statusFilter, setStatusFilter] = useState("all");
  const filteredDecisions = productDecisions.filter(
    (d) => statusFilter === "all" || d.status === statusFilter
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({ title: "", detail: "", owner: "Fahmi" });

  const addDecision = () => {
    if (!draft.title.trim()) {
      showToast("A decision title is required.", "warning");
      return;
    }
    decisionsCrud.add({
      id: newId("decision"),
      productId,
      date: "2026-07-08",
      title: draft.title.trim(),
      detail: draft.detail.trim(),
      owner: draft.owner.trim() || "Fahmi",
      status: "open",
    });
    setDraft({ title: "", detail: "", owner: "Fahmi" });
    setPanelOpen(false);
    showToast("Decision logged.", "success");
  };

  return (
    <div>
      <SectionHeader
        title="Decision Log"
        description="Important decisions and pending confirmations. Click a status to toggle open/decided."
        actions={
          <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            Log Decision
          </Button>
        }
      />

      {panelOpen && (
        <Panel className="mt-4">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_200px]">
            <Field label="Title">
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Detail">
              <Input
                value={draft.detail}
                onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              />
            </Field>
            <Field label="Owner">
              <Input
                value={draft.owner}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={addDecision}>Log Decision</Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {productDecisions.length === 0 && (
        <div className="mt-6">
          <EmptyState>
            No decisions logged for this module yet. Capture the first one.
          </EmptyState>
        </div>
      )}

      {productDecisions.length > 0 && (
        <FilterBar
          className="mt-6"
          groups={[
            {
              label: "Status",
              value: statusFilter,
              onChange: setStatusFilter,
              options: allOf([
                { value: "open", label: "Open" },
                { value: "decided", label: "Decided" },
              ]),
            },
          ]}
          summary={`${filteredDecisions.length} of ${productDecisions.length}`}
        />
      )}

      {productDecisions.length > 0 && filteredDecisions.length === 0 && (
        <div className="mt-6">
          <EmptyState>No decisions match the filters.</EmptyState>
        </div>
      )}

      {filteredDecisions.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {filteredDecisions.map((decision) => (
          <li
            key={decision.id}
            className="group grid gap-2 py-5 md:grid-cols-[100px_1fr_auto] md:gap-6"
          >
            <div className="text-xs tabular-nums text-muted">{decision.date}</div>
            <div>
              <div className="text-sm font-medium text-ink">{decision.title}</div>
              <p className="mt-1 text-sm text-muted">{decision.detail}</p>
              <div className="mt-1 text-xs text-muted">Owner: {decision.owner}</div>
            </div>
            <div className="flex items-start gap-1.5">
              <button
                onClick={() =>
                  decisionsCrud.update(decision.id, {
                    status: decision.status === "open" ? "decided" : "open",
                  })
                }
                aria-label={`Toggle status — currently ${decision.status}`}
                title="Toggle status"
                className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
              >
                <StatusPill status={decision.status} />
              </button>
              <div className="opacity-0 transition-opacity group-hover:opacity-100">
                <ConfirmButton
                  onConfirm={() => {
                    decisionsCrud.remove(decision.id);
                    showToast("Decision removed.", "info");
                  }}
                />
              </div>
            </div>
          </li>
          ))}
        </ul>
      )}
    </div>
  );
}
