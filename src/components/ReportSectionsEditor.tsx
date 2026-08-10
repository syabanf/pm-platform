"use client";

import { useState } from "react";
import { Button, Select, inputClass } from "@/components/ui";
import { REPORT_TOKENS, unknownTokens } from "@/lib/reportTokens";
import type { ReportSection } from "@/lib/types";

const groups = [...new Set(REPORT_TOKENS.map((t) => t.group))];

/**
 * The token palette. Clicking a token appends it to the section body being
 * edited, so nobody has to remember the exact spelling of
 * `{{metrics.completionRate}}` — and a token that is offered here is one the
 * renderer resolves, because both read `REPORT_TOKENS`.
 */
function TokenPalette({ onInsert }: { onInsert: (token: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted underline hover:text-ink"
      >
        {open ? "Hide" : "Show"} available tokens
      </button>
      {open && (
        <div className="mt-2 space-y-2 border border-line p-3">
          {groups.map((group) => (
            <div key={group}>
              <div className="label">{group}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {REPORT_TOKENS.filter((t) => t.group === group).map((t) => (
                  <button
                    key={t.token}
                    type="button"
                    title={t.describe}
                    onClick={() => onInsert(`{{${t.token}}}`)}
                    className="border border-line px-2 py-1 font-mono text-[11px] text-muted hover:border-black hover:text-ink"
                  >
                    {t.token}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Edits the ordered sections of a report template.
 *
 * Each section is a heading plus content from either an auto block — computed
 * from live sprint data — or prose with tokens in it, or both, in that order.
 * `blocks` is passed in rather than imported so this file stays free of the
 * renderers themselves.
 */
export function ReportSectionsEditor({
  sections,
  onChange,
  blocks,
}: {
  sections: ReportSection[];
  onChange: (sections: ReportSection[]) => void;
  blocks: { key: string; label: string; describe: string }[];
}) {
  const patch = (id: string, changes: Partial<ReportSection>) =>
    onChange(sections.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  const move = (index: number, by: number) => {
    const to = index + by;
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  const add = () =>
    onChange([
      ...sections,
      {
        id: `sec-${Date.now()}-${sections.length}`,
        title: "New Section",
        enabled: true,
        body: "",
        autoBlock: "",
      },
    ]);

  return (
    <div>
      <div className="space-y-3">
        {sections.length === 0 && (
          <p className="text-sm text-muted">
            No sections yet. A template with no sections produces a report with
            only its header.
          </p>
        )}
        {sections.map((section, i) => {
          const unknown = unknownTokens(section.body);
          return (
            <div key={section.id} className="border border-line p-4">
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-xs text-muted">{i + 1}.</span>
                <input
                  value={section.title}
                  onChange={(e) => patch(section.id, { title: e.target.value })}
                  aria-label={`Section ${i + 1} title`}
                  className={`${inputClass} py-1.5 font-medium`}
                />
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Move ${section.title} up`}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Move ${section.title} down`}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Remove ${section.title}`}
                    onClick={() =>
                      onChange(sections.filter((s) => s.id !== section.id))
                    }
                  >
                    ✕
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                <div>
                  <span className="label mb-1.5 block">Automatic content</span>
                  <Select
                    value={section.autoBlock}
                    onChange={(value) => patch(section.id, { autoBlock: value })}
                    aria-label={`Automatic content for ${section.title}`}
                  >
                    <option value="">None — prose only</option>
                    {blocks.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.label}
                      </option>
                    ))}
                  </Select>
                  {section.autoBlock && (
                    <p className="mt-1 text-xs text-muted">
                      {blocks.find((b) => b.key === section.autoBlock)?.describe}
                    </p>
                  )}
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={section.enabled}
                    onChange={(e) =>
                      patch(section.id, { enabled: e.target.checked })
                    }
                  />
                  Include
                </label>
              </div>

              <div className="mt-3">
                <span className="label mb-1.5 block">Narrative</span>
                <textarea
                  value={section.body}
                  onChange={(e) => patch(section.id, { body: e.target.value })}
                  rows={3}
                  aria-label={`Narrative for ${section.title}`}
                  placeholder="Sprint {{sprint.number}} closed at {{metrics.completionRate}} of commitment."
                  className={`${inputClass} text-xs`}
                />
                {unknown.length > 0 && (
                  <p className="mt-1 text-xs text-warning">
                    Not a token: {unknown.map((t) => `{{${t}}}`).join(", ")} — it
                    will print as written.
                  </p>
                )}
                <TokenPalette
                  onInsert={(token) =>
                    patch(section.id, {
                      body: section.body
                        ? `${section.body.replace(/\s*$/, "")} ${token}`
                        : token,
                    })
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
      <Button variant="secondary" className="mt-3" onClick={add}>
        Add Section
      </Button>
    </div>
  );
}
