"use client";

import { use, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { AIBadge } from "@/components/AICoachPanel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, inputClass } from "@/components/Document";
import { newId, usePrototype } from "@/lib/store";
import type { BacklogItem, Priority, Readiness } from "@/lib/types";
import { Button, SectionHeader, ToggleButton } from "@/components/ui";

const readinessLabel: Record<Readiness, string> = {
  ready: "Ready",
  "needs-clarification": "Needs Clarification",
  draft: "Draft",
};

export default function BacklogPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const { products, backlog, backlogCrud, masters, showToast } = usePrototype();
  const product = products.find((p) => p.id === productId);
  const items = backlog.filter((b) => b.productId === productId);

  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [readinessFilter, setReadinessFilter] = useState<Readiness | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    story: "",
    moduleId: "",
    type: "story",
    priority: "medium" as Priority,
    estimate: 3,
    acceptanceCriteria: "",
  });

  const filtered = items.filter(
    (item) =>
      (moduleFilter === "all" || item.moduleId === moduleFilter) &&
      (priorityFilter === "all" || item.priority === priorityFilter) &&
      (readinessFilter === "all" || item.readiness === readinessFilter)
  );

  const selected = filtered.find((i) => i.id === selectedId) ?? filtered[0] ?? null;

  if (!product) return null;

  const startCreate = () => {
    setDraft({
      title: "",
      story: "",
      moduleId: product.modules[0]?.id ?? "",
      type: masters.workItemTypes[0] ?? "story",
      priority: "medium",
      estimate: 3,
      acceptanceCriteria: "",
    });
    setCreating(true);
    setEditing(false);
  };

  const startEdit = (item: BacklogItem) => {
    setDraft({
      title: item.title,
      story: item.story,
      moduleId: item.moduleId,
      type: item.type,
      priority: item.priority,
      estimate: item.estimate,
      acceptanceCriteria: item.acceptanceCriteria.join("\n"),
    });
    setEditing(true);
    setCreating(false);
  };

  const computeReadiness = (story: string, ac: string[], estimate: number): Readiness =>
    story.length > 40 && ac.length > 0 && estimate > 0
      ? "ready"
      : story.length > 40
        ? "needs-clarification"
        : "draft";

  const saveDraft = () => {
    if (!draft.title.trim()) {
      showToast("A title is required.", "warning");
      return;
    }
    const ac = draft.acceptanceCriteria.split("\n").map((l) => l.trim()).filter(Boolean);
    const readiness = computeReadiness(draft.story, ac, draft.estimate);
    if (creating) {
      const id = newId("backlog");
      backlogCrud.add({
        id,
        productId,
        moduleId: draft.moduleId,
        title: draft.title.trim(),
        story: draft.story.trim(),
        acceptanceCriteria: ac,
        type: draft.type,
        priority: draft.priority,
        readiness,
        estimate: draft.estimate,
        aiSuggestions:
          readiness === "ready"
            ? []
            : ["This item needs clearer acceptance criteria before sprint planning."],
      });
      setSelectedId(id);
      showToast("Backlog item created.", "success");
    } else if (selected) {
      backlogCrud.update(selected.id, {
        title: draft.title.trim(),
        story: draft.story.trim(),
        moduleId: draft.moduleId,
        type: draft.type,
        priority: draft.priority,
        estimate: draft.estimate,
        acceptanceCriteria: ac,
        readiness,
      });
      showToast("Backlog item updated.", "success");
    }
    setCreating(false);
    setEditing(false);
  };

  const formOpen = creating || editing;

  return (
    <div>
      <SectionHeader
        title="Backlog Refinement"
        description="Make backlog items ready before they enter sprint planning."
        actions={
          <Button size="sm" onClick={startCreate}>
            New Item
          </Button>
        }
      />

      <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr_320px]">
        {/* Left: list + filters */}
        <div>
          <div className="space-y-3 border-b border-line pb-4">
            <div>
              <div className="label mb-1.5">Module</div>
              <div className="flex flex-wrap gap-1.5">
                <ToggleButton active={moduleFilter === "all"} onClick={() => setModuleFilter("all")}>
                  All
                </ToggleButton>
                {product.modules.map((m) => (
                  <ToggleButton key={m.id} active={moduleFilter === m.id} onClick={() => setModuleFilter(m.id)}>
                    {m.name}
                  </ToggleButton>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-1.5">Priority</div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "high", "medium", "low"] as const).map((p) => (
                  <ToggleButton key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
                    {p === "all" ? "All" : p}
                  </ToggleButton>
                ))}
              </div>
            </div>
            <div>
              <div className="label mb-1.5">Readiness</div>
              <div className="flex flex-wrap gap-1.5">
                {(["all", "ready", "needs-clarification", "draft"] as const).map((r) => (
                  <ToggleButton key={r} active={readinessFilter === r} onClick={() => setReadinessFilter(r)}>
                    {r === "all" ? "All" : readinessLabel[r]}
                  </ToggleButton>
                ))}
              </div>
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {filtered.length === 0 && (
              <li className="py-6 text-center text-sm text-muted">
                No backlog items match the filters.
              </li>
            )}
            {filtered.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => {
                    setSelectedId(item.id);
                    setCreating(false);
                    setEditing(false);
                  }}
                  className={`w-full border p-3 text-left transition-colors ${
                    selected?.id === item.id && !creating
                      ? "border-black"
                      : "border-line hover:border-muted"
                  }`}
                >
                  <div className="text-sm font-medium text-ink">{item.title}</div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusPill status={item.readiness} label={readinessLabel[item.readiness]} />
                    <span className="text-xs text-muted tabular-nums">
                      {item.estimate > 0 ? `${item.estimate} pts` : "—"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Center: selected item or form */}
        <div className="md:border-l md:border-line md:pl-8">
          {formOpen ? (
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-ink">
                {creating ? "New Backlog Item" : "Edit Backlog Item"}
              </h3>
              <div className="mt-5 space-y-4">
                <Field label="Title">
                  <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={inputClass} />
                </Field>
                <Field label="User Story">
                  <textarea
                    value={draft.story}
                    onChange={(e) => setDraft({ ...draft, story: e.target.value })}
                    rows={3}
                    className={inputClass}
                    placeholder="As a <role>, I want <capability>, so that <benefit>."
                  />
                </Field>
                <Field label="Acceptance Criteria (one per line)">
                  <textarea
                    value={draft.acceptanceCriteria}
                    onChange={(e) => setDraft({ ...draft, acceptanceCriteria: e.target.value })}
                    rows={4}
                    className={`${inputClass} font-mono text-xs`}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Module">
                    <select
                      value={draft.moduleId}
                      onChange={(e) => setDraft({ ...draft, moduleId: e.target.value })}
                      className={inputClass}
                    >
                      {product.modules.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Type">
                    <select
                      value={draft.type}
                      onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                      className={inputClass}
                    >
                      {masters.workItemTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select
                      value={draft.priority}
                      onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}
                      className={inputClass}
                    >
                      {masters.priorities.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Estimate (pts)">
                    <input
                      type="number"
                      min={0}
                      value={draft.estimate}
                      onChange={(e) => setDraft({ ...draft, estimate: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
              <div className="mt-5 flex gap-2">
                <Button onClick={saveDraft}>
                  {creating ? "Create Item" : "Save Changes"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCreating(false);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : selected ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-xl font-semibold tracking-tight text-ink">
                  {selected.title}
                </h3>
                <div className="flex items-center gap-1.5">
                  <StatusPill status={selected.priority} label={`${selected.priority} priority`} />
                  <button
                    onClick={() => startEdit(selected)}
                    className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                  >
                    Edit
                  </button>
                  <ConfirmButton
                    onConfirm={() => {
                      backlogCrud.remove(selected.id);
                      setSelectedId(null);
                      showToast("Backlog item deleted.", "info");
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 text-xs text-muted">
                Module: {product.modules.find((m) => m.id === selected.moduleId)?.name ?? "—"} ·{" "}
                {selected.type} ·{" "}
                {selected.estimate > 0 ? `${selected.estimate} pts` : "not estimated"}
              </div>

              <div className="mt-6">
                <div className="label">User Story</div>
                <p className="mt-2 text-sm leading-relaxed text-ink">
                  {selected.story || <span className="text-muted">No story yet.</span>}
                </p>
              </div>

              <div className="mt-6">
                <div className="label">Acceptance Criteria</div>
                {selected.acceptanceCriteria.length === 0 ? (
                  <p className="mt-2 text-sm text-warning">
                    This item needs clearer acceptance criteria before sprint planning.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {selected.acceptanceCriteria.map((ac) => (
                      <li key={ac} className="flex gap-2 text-sm text-ink">
                        <span className="text-muted">—</span> {ac}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6">
                <div className="label">Definition of Ready</div>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className={selected.story.length > 40 ? "text-success" : "text-danger"}>
                    {selected.story.length > 40 ? "✓" : "✗"} Story is written in user story format
                  </li>
                  <li className={selected.acceptanceCriteria.length > 0 ? "text-success" : "text-danger"}>
                    {selected.acceptanceCriteria.length > 0 ? "✓" : "✗"} Acceptance criteria defined
                  </li>
                  <li className={selected.estimate > 0 ? "text-success" : "text-danger"}>
                    {selected.estimate > 0 ? "✓" : "✗"} Estimated by the team
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              Select a backlog item, or create a new one.
            </p>
          )}
        </div>

        {/* Right: AI refinement — full-width row on tablet, third pane on desktop */}
        <div className="md:col-span-2 lg:col-span-1">
          <div className="border border-line border-l-2 border-l-ai p-5">
            <div className="flex items-center justify-between">
              <AIBadge />
              <span className="label">Refinement</span>
            </div>
            {!formOpen && selected && selected.aiSuggestions.length > 0 ? (
              <>
                <ul className="mt-4 space-y-3">
                  {selected.aiSuggestions.map((s) => (
                    <li key={s} className="text-sm leading-relaxed text-ink">{s}</li>
                  ))}
                </ul>
                <div className="mt-5 flex flex-col gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      showToast("AI suggestion applied. Story and acceptance criteria updated.", "success")
                    }
                  >
                    Apply Suggestion
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => showToast("Suggestion dismissed for this item.")}
                  >
                    Dismiss
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-muted">
                {formOpen
                  ? "Readiness is checked automatically when you save."
                  : selected
                    ? "This item looks sprintable. No refinement suggestions."
                    : "Select an item to see AI refinement suggestions."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
