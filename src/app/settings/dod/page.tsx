"use client";

import { useState } from "react";
import { inputClass } from "@/components/Document";
import { Button, SectionHeader } from "@/components/ui";
import { usePrototype } from "@/lib/store";

export default function DodTemplatePage() {
  const { dodTemplate, setDodTemplate, showToast } = usePrototype();
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const item = draft.trim();
    if (!item) return;
    if (dodTemplate.includes(item)) {
      showToast("That checklist item already exists.", "warning");
      return;
    }
    setDodTemplate([...dodTemplate, item]);
    setDraft("");
    showToast("Checklist item added to the DoD template.", "success");
  };

  return (
    <div className="max-w-2xl">
      <SectionHeader
        title="Definition of Done Template"
        description="The default quality checklist applied to every new task created on a sprint board. Tasks cannot move to Done until their checklist is complete."
      />

      <ul className="mt-6 divide-y divide-line border-y border-line">
        {dodTemplate.map((item, i) => (
          <li key={item} className="flex items-center gap-3 py-3">
            <span className="text-xs tabular-nums text-muted">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-sm text-ink">{item}</span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDodTemplate(dodTemplate.filter((d) => d !== item));
                showToast("Checklist item removed.", "info");
              }}
            >
              Remove
            </Button>
          </li>
        ))}
        {dodTemplate.length === 0 && (
          <li className="py-4 text-sm text-warning">
            The template is empty — new tasks will have no quality gate.
          </li>
        )}
      </ul>

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="e.g. Acceptance criteria verified"
          className={inputClass}
        />
        <Button className="shrink-0" onClick={addItem}>
          Add Item
        </Button>
      </div>
    </div>
  );
}
