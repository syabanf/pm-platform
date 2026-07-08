"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { inputClass } from "@/components/Document";
import { Button } from "@/components/ui";
import { masterListMeta, type MasterListKey } from "@/lib/data";
import { usePrototype } from "@/lib/store";

function ListMasterCard({ listKey }: { listKey: MasterListKey }) {
  const { masters, addMasterValue, renameMasterValue, removeMasterValue, showToast } =
    usePrototype();
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const items = masters[listKey];
  const meta = masterListMeta[listKey];

  const add = () => {
    if (!draft.trim()) return;
    if (addMasterValue(listKey, draft)) {
      showToast(`Added to ${meta.title}.`, "success");
      setDraft("");
    } else {
      showToast("That value already exists.", "warning");
    }
  };

  const saveRename = (oldValue: string) => {
    if (editValue.trim() && editValue.trim() !== oldValue) {
      renameMasterValue(listKey, oldValue, editValue);
      showToast(`Renamed across all records using it.`, "success");
    }
    setEditing(null);
  };

  return (
    <div className="border border-line p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink">{meta.title}</h3>
        <span className="text-[11px] uppercase tracking-wide text-muted">
          {meta.usedBy}
        </span>
      </div>

      <ul className="mt-3 divide-y divide-line border-y border-line">
        {items.length === 0 && (
          <li className="py-2.5 text-xs text-warning">
            Empty — forms using this list will have no options.
          </li>
        )}
        {items.map((item) => (
          <li key={item} className="group flex items-center gap-2 py-2">
            {editing === item ? (
              <>
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveRename(item);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className={`${inputClass} py-1 text-xs`}
                />
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => saveRename(item)}
                >
                  Save
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-ink">{item}</span>
                <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing(item);
                      setEditValue(item);
                    }}
                  >
                    Edit
                  </Button>
                  <ConfirmButton
                    onConfirm={() => {
                      removeMasterValue(listKey, item);
                      showToast(
                        "Removed. Existing records keep the old value.",
                        "info"
                      );
                    }}
                  />
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add value…"
          className={`${inputClass} py-1.5 text-xs`}
        />
        <Button size="sm" className="shrink-0" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}

const listOrder: MasterListKey[] = [
  "industries",
  "contractTypes",
  "jobRoles",
  "skillTags",
  "workItemTypes",
  "priorities",
  "impactAreas",
];

export default function ListMastersPage() {
  return (
    <div>
      <h2 className="label">List Masters</h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        The lookup values behind every form. Renaming a value updates all
        records that use it; removing one keeps historical records unchanged.
      </p>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listOrder.map((key) => (
          <ListMasterCard key={key} listKey={key} />
        ))}
      </div>
    </div>
  );
}
