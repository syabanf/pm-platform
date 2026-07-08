"use client";

import { useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field, inputClass } from "@/components/Document";
import { Button, Panel, SectionHeader, ToggleButton } from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";
import type { ReportTemplateDef } from "@/lib/data";

const emptyDraft = {
  name: "",
  audience: "",
  frequency: "Sprint-end",
  visibility: "internal" as ReportTemplateDef["visibility"],
  sections: "",
};

export default function ReportTemplatesPage() {
  const { reportTemplates, reportTemplatesCrud, showToast } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  };

  const openEdit = (tpl: ReportTemplateDef) => {
    setEditingId(tpl.id);
    setDraft({
      name: tpl.name,
      audience: tpl.audience,
      frequency: tpl.frequency,
      visibility: tpl.visibility,
      sections: tpl.sections.join("\n"),
    });
    setPanelOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Template name is required.", "warning");
      return;
    }
    const sections = draft.sections
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (editingId) {
      reportTemplatesCrud.update(editingId, {
        name: draft.name.trim(),
        audience: draft.audience.trim(),
        frequency: draft.frequency,
        visibility: draft.visibility,
        sections,
      });
      showToast("Template updated.", "success");
    } else {
      reportTemplatesCrud.add({
        id: newId("tpl"),
        name: draft.name.trim(),
        audience: draft.audience.trim() || "—",
        frequency: draft.frequency,
        visibility: draft.visibility,
        formats: ["Markdown"],
        sections,
      });
      showToast("Template created.", "success");
    }
    setPanelOpen(false);
  };

  return (
    <div>
      <SectionHeader
        title="Report Template Master"
        description="Templates keep report formats consistent. Each defines its audience and section structure (spec §17)."
        actions={
          <Button size="sm" onClick={openCreate}>
            Add Template
          </Button>
        }
      />

      {panelOpen && (
        <Panel title={editingId ? "Edit Template" : "New Template"} className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <Field label="Template Name">
                <input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Audience">
                <input
                  value={draft.audience}
                  onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. Steering committee"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Frequency">
                  <select
                    value={draft.frequency}
                    onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}
                    className={inputClass}
                  >
                    <option>Weekly</option>
                    <option>Sprint-end</option>
                    <option>Monthly</option>
                    <option>Sprint-end / Monthly</option>
                  </select>
                </Field>
                <Field label="Visibility">
                  <div className="flex gap-1.5">
                    {(["internal", "client-facing"] as const).map((v) => (
                      <ToggleButton
                        key={v}
                        active={draft.visibility === v}
                        onClick={() => setDraft({ ...draft, visibility: v })}
                      >
                        {v}
                      </ToggleButton>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
            <Field label="Sections (one per line)">
              <textarea
                value={draft.sections}
                onChange={(e) => setDraft({ ...draft, sections: e.target.value })}
                rows={8}
                className={`${inputClass} font-mono text-xs`}
                placeholder={"Executive Summary\nProgress\nRisks"}
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save}>
              {editingId ? "Save Changes" : "Create Template"}
            </Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {reportTemplates.map((tpl) => (
          <div key={tpl.id} className="group border border-line p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-ink">{tpl.name}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {tpl.audience} · {tpl.frequency} · {tpl.formats.join(", ")}
                </div>
              </div>
              <StatusPill
                status={tpl.visibility === "client-facing" ? "review" : "planned"}
                label={tpl.visibility}
              />
            </div>
            <ol className="mt-3 space-y-0.5 border-t border-line pt-3">
              {tpl.sections.map((section, i) => (
                <li key={section} className="flex gap-2 text-xs text-ink">
                  <span className="tabular-nums text-muted">{i + 1}.</span>
                  {section}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="secondary" size="sm" onClick={() => openEdit(tpl)}>
                Edit
              </Button>
              <ConfirmButton
                onConfirm={() => {
                  reportTemplatesCrud.remove(tpl.id);
                  showToast("Template removed.", "info");
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
