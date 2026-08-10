"use client";

import { use, useState } from "react";
import { AIInsightBlock, AIBadge } from "@/components/AICoachPanel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { StatusPill } from "@/components/StatusPill";
import { Button, EmptyState, Select, inputClass } from "@/components/ui";
import { retroInsights } from "@/lib/data";
import { newId, usePrototype } from "@/lib/store";
import type { RetroNote } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

/** One of the two retro columns: its own list, its own add box. */
function NoteColumn({
  sprintId,
  kind,
  heading,
  tone,
  placeholder,
}: {
  sprintId: string;
  kind: RetroNote["kind"];
  heading: string;
  /**
   * Whole class names, not a colour to interpolate. `bg-${tone}` is assembled
   * at runtime, so Tailwind never sees it — it would render correctly only for
   * as long as some other file happens to use the same class.
   */
  tone: { heading: string; dot: string };
  placeholder: string;
}) {
  const { retroNotes, retroNotesCrud, showToast } = usePrototype();
  const [draft, setDraft] = useState("");

  const notes = retroNotes.filter(
    (n) => n.sprintId === sprintId && n.kind === kind
  );

  const add = () => {
    if (!draft.trim()) return;
    retroNotesCrud.add({
      id: newId("retro-note"),
      sprintId,
      kind,
      text: draft.trim(),
    });
    setDraft("");
  };

  return (
    <section>
      <h4 className={`label ${tone.heading}`}>{heading}</h4>
      {notes.length === 0 ? (
        <EmptyState className="mt-3">
          Nothing captured yet. Add what the team said.
        </EmptyState>
      ) : (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {notes.map((note) => (
            <li key={note.id} className="group flex items-center gap-3 py-3">
              <span className={`h-1.5 w-1.5 shrink-0 ${tone.dot}`} />
              <span className="flex-1 text-sm text-ink">{note.text}</span>
              <span className="opacity-0 transition-opacity group-hover:opacity-100">
                <ConfirmButton
                  onConfirm={() => {
                    retroNotesCrud.remove(note.id);
                    showToast("Note removed.", "info");
                  }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          aria-label={`Add to ${heading}`}
          className={`${inputClass} py-1.5 text-sm`}
        />
        <Button size="sm" className="shrink-0" onClick={add}>
          Add
        </Button>
      </div>
    </section>
  );
}

export default function SprintRetroPage({
  params,
}: {
  params: Promise<{ sprintId: string }>;
}) {
  const { sprintId } = use(params);
  const { retroActions, retroActionsCrud, members, showToast } = usePrototype();
  const [draft, setDraft] = useState({
    action: "",
    ownerId: "",
    due: today(),
  });

  const actions = retroActions.filter((a) => a.sprintId === sprintId);
  const doneActions = actions.filter((a) => a.status === "done").length;
  const ownerName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? "Unassigned";

  const addAction = () => {
    if (!draft.action.trim()) {
      showToast("Describe the action first.", "warning");
      return;
    }
    retroActionsCrud.add({
      id: newId("retro-action"),
      sprintId,
      action: draft.action.trim(),
      ownerId: draft.ownerId || members[0]?.id || "",
      due: draft.due,
      status: "open",
    });
    setDraft({ action: "", ownerId: draft.ownerId, due: draft.due });
    showToast("Retro action added.", "success");
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            Sprint Retrospective
          </h3>
          <p className="mt-1 text-sm text-muted">
            Improve how the team works, sprint over sprint. Every improvement
            gets an owner and a due date.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-ink">
            {doneActions}/{actions.length}
          </div>
          <div className="label mt-0.5">Actions Completed</div>
        </div>
      </div>

      <div className="mt-8 grid gap-12 md:grid-cols-2">
        <NoteColumn
          sprintId={sprintId}
          kind="went-well"
          heading="Went Well"
          tone={{ heading: "text-success", dot: "bg-success" }}
          placeholder="e.g. QA scenarios were ready early"
        />
        <NoteColumn
          sprintId={sprintId}
          kind="needs-improvement"
          heading="Needs Improvement"
          tone={{ heading: "text-warning", dot: "bg-warning" }}
          placeholder="e.g. requirement loops took too long"
        />
      </div>

      <section className="mt-12">
        <h4 className="label">Retro Actions — Owner &amp; Due Date</h4>
        {actions.length === 0 ? (
          <EmptyState className="mt-3">
            No actions yet. A retro without one changes nothing next sprint.
          </EmptyState>
        ) : (
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {actions.map((action) => (
              <li
                key={action.id}
                className="group grid gap-2 py-4 md:grid-cols-[1fr_120px_110px_auto_auto] md:items-center md:gap-6"
              >
                <span
                  className={`text-sm ${action.status === "done" ? "text-muted line-through" : "text-ink"}`}
                >
                  {action.action}
                </span>
                <span className="text-sm text-muted">
                  {ownerName(action.ownerId)}
                </span>
                <span className="text-xs tabular-nums text-muted">
                  {action.due}
                </span>
                <StatusPill status={action.status} />
                <div className="flex gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      retroActionsCrud.update(action.id, {
                        status: action.status === "done" ? "open" : "done",
                      })
                    }
                  >
                    {action.status === "done" ? "Reopen" : "Close"}
                  </Button>
                  <ConfirmButton
                    onConfirm={() => {
                      retroActionsCrud.remove(action.id);
                      showToast("Action removed.", "info");
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-2 md:grid-cols-[1fr_160px_140px_auto]">
          <input
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            placeholder="What will the team change?"
            aria-label="New retro action"
            className={`${inputClass} py-1.5 text-sm`}
          />
          <Select
            value={draft.ownerId || members[0]?.id || ""}
            onChange={(ownerId) => setDraft({ ...draft, ownerId })}
            aria-label="Action owner"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <input
            type="date"
            value={draft.due}
            onChange={(e) => setDraft({ ...draft, due: e.target.value })}
            aria-label="Action due date"
            className={`${inputClass} py-1.5 text-sm`}
          />
          <Button className="shrink-0" onClick={addAction}>
            Add Action
          </Button>
        </div>
      </section>

      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h4 className="label">Root Cause AI</h4>
          <div className="mt-3">
            <AIInsightBlock insight={retroInsights.rootCause} />
          </div>
        </div>
        <div>
          <h4 className="label">Retro Memory</h4>
          {/*
            Not per sprint, deliberately: this text is about a pattern across
            Sprints 01 to 03, which makes it an observation about the module.
            Copying it onto each sprint would make it false.
          */}
          <div className="mt-3 border border-line border-l-2 border-l-ai p-5">
            <AIBadge />
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {retroInsights.memory}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
