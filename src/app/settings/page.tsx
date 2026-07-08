"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/Document";
import { Button, SectionHeader } from "@/components/ui";
import { usePrototype } from "@/lib/store";

const brandSwatches = ["#ED1C24", "#000000", "#111827", "#1D4ED8", "#047857"];

export default function WorkspaceSettingsPage() {
  const { workspaceConf, setWorkspaceConf, showToast } = usePrototype();
  const [draft, setDraft] = useState(workspaceConf);

  return (
    <div className="max-w-2xl">
      <SectionHeader
        title="Workspace"
        description="Identity and delivery defaults. The sprint defaults pre-fill new sprint planning sessions."
      />

      <div className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Workspace Name">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Company">
            <input
              value={draft.company}
              onChange={(e) => setDraft({ ...draft, company: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Field label="Brand Color">
          <div className="flex items-center gap-2">
            {brandSwatches.map((color) => (
              <button
                key={color}
                onClick={() => setDraft({ ...draft, brandColor: color })}
                className={`h-8 w-8 border-2 ${
                  draft.brandColor === color ? "border-ink" : "border-line"
                }`}
                style={{ backgroundColor: color }}
                aria-label={`Brand color ${color}`}
              />
            ))}
            <span className="ml-2 text-xs tabular-nums text-muted">
              {draft.brandColor}
            </span>
          </div>
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={`Sprint Length — ${draft.sprintLengthDays} working days`}>
            <input
              type="range"
              min={5}
              max={20}
              step={5}
              value={draft.sprintLengthDays}
              onChange={(e) =>
                setDraft({ ...draft, sprintLengthDays: Number(e.target.value) })
              }
              className="mt-2 w-full accent-black"
            />
          </Field>
          <Field label={`Working Days / Week — ${draft.workingDaysPerWeek}`}>
            <input
              type="range"
              min={4}
              max={6}
              step={1}
              value={draft.workingDaysPerWeek}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  workingDaysPerWeek: Number(e.target.value),
                })
              }
              className="mt-2 w-full accent-black"
            />
          </Field>
        </div>
        <div className="border-t border-line pt-5">
          <Button
            onClick={() => {
              setWorkspaceConf(draft);
              showToast("Workspace settings saved.", "success");
            }}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
