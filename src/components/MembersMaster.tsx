"use client";

import { useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AIInsightBlock } from "@/components/AICoachPanel";
import { Field } from "@/components/Document";
import {
  allOf,
  Button,
  FilterBar,
  Input,
  Panel,
  Select,
  SectionHeader,
} from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";
import type { Member } from "@/lib/types";

const emptyDraft = {
  name: "",
  roleLabel: "Fullstack Developer",
  allocation: 50,
  skillTags: [] as string[],
};

export function MembersMaster({
  heading = "Module Member Master",
  description = "The resource pool for this module. Sprint members are selected from this list during sprint planning.",
}: {
  heading?: string;
  description?: string;
}) {
  const { members, membersCrud, masters, showToast } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const overloaded = members.filter((m) => m.workload > 100);

  const roleOptions = Array.from(
    new Set(members.map((m) => m.roleLabel))
  ).sort();

  const filtered = members.filter(
    (m) =>
      (roleFilter === "all" || m.roleLabel === roleFilter) &&
      (statusFilter === "all" || m.status === statusFilter)
  );

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  };

  const openEdit = (member: Member) => {
    setEditingId(member.id);
    setDraft({
      name: member.name,
      roleLabel: member.roleLabel,
      allocation: member.allocation,
      skillTags: member.skillTags,
    });
    setPanelOpen(true);
  };

  const toggleTag = (tag: string) =>
    setDraft((d) => ({
      ...d,
      skillTags: d.skillTags.includes(tag)
        ? d.skillTags.filter((t) => t !== tag)
        : [...d.skillTags, tag],
    }));

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Member name is required.", "warning");
      return;
    }
    const capacityDays = (10 * draft.allocation) / 100;
    if (editingId) {
      membersCrud.update(editingId, {
        name: draft.name.trim(),
        roleLabel: draft.roleLabel,
        role: draft.roleLabel,
        allocation: draft.allocation,
        capacityDays,
        skillTags: draft.skillTags,
      });
      showToast("Member updated.", "success");
    } else {
      membersCrud.add({
        id: newId("member"),
        name: draft.name.trim(),
        email: `${draft.name.trim().toLowerCase().split(" ")[0]}@wit.id`,
        role: draft.roleLabel,
        roleLabel: draft.roleLabel,
        skillTags: draft.skillTags,
        allocation: draft.allocation,
        capacityDays,
        workload: 0,
        status: "active",
      });
      showToast("Member added to the module pool.", "success");
    }
    setPanelOpen(false);
  };

  return (
    <div>
      <SectionHeader
        title={heading}
        description={description}
        actions={
          <Button size="sm" onClick={openCreate}>
            Add Member
          </Button>
        }
      />

      {panelOpen && (
        <Panel title={editingId ? "Edit Member" : "New Member"} className="mt-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <Select
                value={draft.roleLabel}
                onChange={(e) => setDraft({ ...draft, roleLabel: e.target.value })}
              >
                {masters.jobRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`Allocation — ${draft.allocation}%`}>
              <input
                type="range"
                min={25}
                max={100}
                step={25}
                value={draft.allocation}
                onChange={(e) =>
                  setDraft({ ...draft, allocation: Number(e.target.value) })
                }
                className="mt-2 w-full accent-black"
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Skill Tags">
              <div className="flex flex-wrap gap-1.5">
                {masters.skillTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`border px-2.5 py-1 text-xs ${
                      draft.skillTags.includes(tag)
                        ? "border-black bg-black font-medium text-paper"
                        : "border-line text-muted hover:border-black hover:text-ink"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save}>
              {editingId ? "Save Changes" : "Add Member"}
            </Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <FilterBar
        className="mt-6"
        groups={[
          {
            label: "Role",
            value: roleFilter,
            onChange: setRoleFilter,
            options: allOf(
              roleOptions.map((role) => ({ value: role, label: role }))
            ),
          },
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: allOf([
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "temporary", label: "Temporary" },
            ]),
          },
        ]}
        summary={`${filtered.length} of ${members.length}`}
      />

      <div className="mt-6">
        <DataTable
          headers={[
            "Name",
            "Role",
            "Allocation",
            "Sprint Capacity",
            "Workload",
            "Status",
            "",
          ]}
        >
          {filtered.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-sm text-muted">
                No members match the filters.
              </td>
            </tr>
          )}
          {filtered.map((member) => {
            const isOverloaded = member.workload > 100;
            return (
              <tr key={member.id} className="group">
                <td className="py-4 pr-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center bg-soft text-xs font-semibold text-ink">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-ink">{member.name}</div>
                      <div className="text-xs text-muted">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 pr-6">
                  <div className="text-muted">{member.roleLabel}</div>
                  {member.skillTags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {member.skillTags.map((tag) => (
                        <span
                          key={tag}
                          className="border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="py-4 pr-6 tabular-nums">{member.allocation}%</td>
                <td className="py-4 pr-6 tabular-nums">
                  {member.capacityDays} days
                </td>
                <td className="py-4 pr-6">
                  <div className="flex items-center gap-3">
                    <div className="h-1 w-24 bg-soft">
                      <div
                        className={`h-1 ${isOverloaded ? "bg-danger" : member.workload > 85 ? "bg-warning" : "bg-black"}`}
                        style={{ width: `${Math.min(member.workload, 100)}%` }}
                      />
                    </div>
                    <span
                      className={`text-sm tabular-nums ${isOverloaded ? "font-semibold text-danger" : ""}`}
                    >
                      {member.workload}%
                    </span>
                  </div>
                </td>
                <td className="py-4 pr-6">
                  <StatusPill
                    status={isOverloaded ? "overloaded" : member.status}
                  />
                </td>
                <td className="py-4 text-right">
                  <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(member)}
                      className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                    >
                      Edit
                    </button>
                    <ConfirmButton
                      onConfirm={() => {
                        membersCrud.remove(member.id);
                        showToast(`${member.name} removed from the pool.`, "info");
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>

      {overloaded.length > 0 && (
        <div className="mt-8 max-w-xl">
          <AIInsightBlock
            insight={{
              insight: `${overloaded.map((m) => m.name).join(", ")} is overloaded at ${overloaded[0].workload}% capacity.`,
              reason:
                "Assigned work exceeds sprint capacity based on current allocation.",
              recommendations: [
                "Move 1 backend task to next sprint",
                "Assign support from another member",
              ],
              confidence: "high",
            }}
          />
        </div>
      )}
    </div>
  );
}
