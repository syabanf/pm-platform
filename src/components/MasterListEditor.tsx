"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Button, EmptyState, inputClass } from "@/components/ui";
import { masterListMeta, type MasterListKey } from "@/lib/data";
import { usePrototype } from "@/lib/store";

/**
 * Add / rename / remove the values of one master list.
 *
 * Renaming is not a relabel — the store rewrites every record that referenced
 * the old value, which is the difference between a master list and a hardcoded
 * array. Removing deliberately does not: existing records keep the value they
 * were given, so deleting an industry never silently reassigns a client.
 */
export function MasterListEditor({ listKey }: { listKey: MasterListKey }) {
  const {
    masters,
    addMasterValue,
    renameMasterValue,
    removeMasterValue,
    showToast,
  } = usePrototype();
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
      showToast("Renamed across every record using it.", "success");
    }
    setEditing(null);
  };

  return (
    <div>
      <ul className="divide-y divide-line border-y border-line">
        {items.length === 0 && (
          <li className="py-3">
            <EmptyState>
              Empty — every form using this list has no options to offer.
            </EmptyState>
          </li>
        )}
        {items.map((item) => (
          <li key={item} className="group flex items-center gap-2 py-2.5">
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
                  aria-label={`Rename ${item}`}
                  className={`${inputClass} py-1 text-sm`}
                />
                <Button size="sm" className="shrink-0" onClick={() => saveRename(item)}>
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
                <div className="flex gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
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

      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add value…"
          aria-label={`Add a value to ${meta.title}`}
          className={`${inputClass} py-1.5`}
        />
        <Button className="shrink-0" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
