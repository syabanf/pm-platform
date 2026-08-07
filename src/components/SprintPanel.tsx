"use client";

import { useState } from "react";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";
import type { Sprint } from "@/lib/types";

/** Local-time ISO date. `toISOString()` would shift a date across midnight. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/** Working days in a range, so nobody has to count weekends by hand. */
export function workingDaysBetween(start: string, end: string) {
  const from = new Date(`${start}T00:00:00`);
  const to = new Date(`${end}T00:00:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
    return 0;
  }
  let days = 0;
  for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return days;
}

/** A fortnight from today — the shape of almost every sprint anyone creates. */
export function defaultSprintDates() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return { startDate: iso(start), endDate: iso(end) };
}

export type SprintDraft = {
  name: string;
  goal: string;
  status: Sprint["status"];
  startDate: string;
  endDate: string;
  moduleId: string;
};

export const emptySprintDraft = (moduleId = ""): SprintDraft => ({
  name: "",
  goal: "",
  status: "planning",
  ...defaultSprintDates(),
  moduleId,
});

export const draftFromSprint = (sprint: Sprint): SprintDraft => ({
  name: sprint.name,
  goal: sprint.goal,
  status: sprint.status,
  startDate: sprint.startDate,
  endDate: sprint.endDate,
  moduleId: sprint.moduleId,
});

/**
 * The one sprint form.
 *
 * Both the Module's Sprints tab and a Component's page open this, so a sprint
 * is created the same way from either, and a fix here reaches both. The
 * Component page passes `lockedModuleId` because the owner is already decided
 * by where you are standing; the Module page shows the picker instead.
 *
 * Only the name has to be typed. Dates arrive filled in with the usual
 * fortnight and working days are counted from them, because the app can work
 * that out and a person should not have to.
 */
export function SprintPanel({
  productId,
  components,
  lockedModuleId,
  editingId,
  draft,
  setDraft,
  onClose,
}: {
  productId: string;
  components: { id: string; name: string }[];
  lockedModuleId?: string;
  editingId: string | null;
  draft: SprintDraft;
  setDraft: (draft: SprintDraft) => void;
  onClose: () => void;
}) {
  const { sprints, sprintsCrud, showToast } = usePrototype();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SprintDraft>(key: K, value: SprintDraft[K]) => {
    setDraft({ ...draft, [key]: value });
    if (error) setError(null);
  };

  const moduleId = lockedModuleId ?? draft.moduleId;
  const days = workingDaysBetween(draft.startDate, draft.endDate);
  const componentName = (id: string) =>
    components.find((c) => c.id === id)?.name ?? "this component";

  const save = () => {
    if (!draft.name.trim()) {
      setError("Give the sprint a name — something the team will recognise.");
      return;
    }
    if (!moduleId) {
      setError("Choose which component this sprint belongs to.");
      return;
    }
    if (new Date(draft.endDate) < new Date(draft.startDate)) {
      setError("The end date falls before the start date.");
      return;
    }

    const fields = {
      name: draft.name.trim(),
      goal: draft.goal.trim() || "Sprint goal to be defined.",
      status: draft.status,
      startDate: draft.startDate,
      endDate: draft.endDate,
      moduleId,
      workingDays: days,
    };

    if (editingId) {
      sprintsCrud.update(editingId, fields);
      showToast("Sprint updated.", "success");
      onClose();
      return;
    }

    const nextNumber =
      sprints
        .filter((s) => s.productId === productId)
        .reduce((max, s) => Math.max(max, s.number), 0) + 1;

    sprintsCrud.add({
      id: newId("sprint"),
      productId,
      number: nextNumber,
      ...fields,
      daysLeft: days,
      members: [],
      backlogItemIds: [],
      committed: 0,
      completed: 0,
      progress: 0,
      risk: "low",
    });
    showToast(
      `Sprint ${String(nextNumber).padStart(2, "0")} added to ${componentName(
        moduleId
      )}. Plan it next.`,
      "success"
    );
    onClose();
  };

  return (
    <Panel
      title={editingId ? "Edit sprint" : "New sprint"}
      className="animate-in mt-4"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name">
          <input
            className={inputClass}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Ingestion Hardening"
            autoFocus
          />
        </Field>

        {!lockedModuleId && (
          <Field label="Component">
            <select
              className={inputClass}
              value={draft.moduleId}
              onChange={(e) => set("moduleId", e.target.value)}
            >
              <option value="">Choose a component…</option>
              {components.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Goal (optional)">
          <input
            className={inputClass}
            value={draft.goal}
            onChange={(e) => set("goal", e.target.value)}
            placeholder="What this sprint is meant to achieve"
          />
        </Field>

        <Field label="Status">
          <select
            className={inputClass}
            value={draft.status}
            onChange={(e) => set("status", e.target.value as Sprint["status"])}
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </Field>

        <Field label="Starts">
          <input
            type="date"
            className={inputClass}
            value={draft.startDate}
            onChange={(e) => set("startDate", e.target.value)}
          />
        </Field>

        <Field label="Ends">
          <input
            type="date"
            className={inputClass}
            value={draft.endDate}
            onChange={(e) => set("endDate", e.target.value)}
          />
        </Field>
      </div>

      <p className="mt-3 text-xs text-muted">
        {days > 0
          ? `${days} working days — weekends are not counted.`
          : "Pick an end date on or after the start date."}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <Button size="sm" onClick={save}>
          {editingId ? "Save changes" : "Add sprint"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Panel>
  );
}
