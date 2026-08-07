"use client";

import { use, useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field } from "@/components/Document";
import {
  allOf,
  Button,
  EmptyState,
  FilterBar,
  Input,
  Panel,
  SectionHeader,
} from "@/components/ui";
import { componentPath } from "@/lib/data";
import { newId, usePrototype } from "@/lib/store";
import type { Component } from "@/lib/types";

const emptyDraft = { name: "", owner: "" };

export default function ComponentsPage({
  params,
}: {
  params: Promise<{ moduleId: string }>;
}) {
  const { moduleId } = use(params);
  const {
    modules,
    backlog,
    sprints,
    tasks,
    modulesCrud,
    sprintsCrud,
    tasksCrud,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [statusFilter, setStatusFilter] = useState("all");

  const mod = modules.find((p) => p.id === moduleId);
  if (!mod) return null;
  const moduleBacklog = backlog.filter((b) => b.moduleId === moduleId);
  const filteredComponents = mod.components.filter(
    (m) => statusFilter === "all" || m.status === statusFilter
  );

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  };

  const openEdit = (component: Component) => {
    setEditingId(component.id);
    setDraft({ name: component.name, owner: component.owner });
    setPanelOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Component name is required.", "warning");
      return;
    }
    if (editingId) {
      modulesCrud.update(mod.id, {
        components: mod.components.map((m) =>
          m.id === editingId
            ? {
                ...m,
                name: draft.name.trim(),
                owner: draft.owner.trim() || "Unassigned",
              }
            : m
        ),
      });
      showToast("Component updated.", "success");
    } else {
      modulesCrud.update(mod.id, {
        components: [
          ...mod.components,
          {
            id: newId("component"),
            name: draft.name.trim(),
            owner: draft.owner.trim() || "Unassigned",
            status: "planned",
          },
        ],
      });
      showToast("Component added.", "success");
    }
    setDraft(emptyDraft);
    setEditingId(null);
    setPanelOpen(false);
  };

  const removeComponent = (componentId: string) => {
    modulesCrud.update(mod.id, {
      components: mod.components.filter((m) => m.id !== componentId),
    });
    const removedSprintIds = sprints
      .filter((s) => s.moduleId === mod.id && s.componentId === componentId)
      .map((s) => s.id);
    removedSprintIds.forEach((id) => sprintsCrud.remove(id));
    tasks
      .filter((t) => removedSprintIds.includes(t.sprintId))
      .forEach((t) => tasksCrud.remove(t.id));
    showToast("Component removed.", "info");
  };

  const cycleStatus = (componentId: string) => {
    const order = ["planned", "in-progress", "done"] as const;
    modulesCrud.update(mod.id, {
      components: mod.components.map((m) =>
        m.id === componentId
          ? { ...m, status: order[(order.indexOf(m.status) + 1) % order.length] }
          : m
      ),
    });
  };

  return (
    <div>
      <SectionHeader
        title="Components"
        description="Functional parts of this module. Open a component to manage its sprints; click a status to change it."
        actions={
          <Button
            size="sm"
            onClick={() =>
              panelOpen && !editingId ? setPanelOpen(false) : openCreate()
            }
          >
            Add Component
          </Button>
        }
      />

      {panelOpen && (
        <Panel
          title={editingId ? "Edit Component" : undefined}
          className="animate-in mt-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Component Name">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Notifications"
              />
            </Field>
            <Field label="Owner">
              <Input
                value={draft.owner}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              />
            </Field>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={save}>
              {editingId ? "Save Changes" : "Add Component"}
            </Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {mod.components.length > 0 && (
        <FilterBar
          className="mt-6"
          groups={[
            {
              label: "Status",
              value: statusFilter,
              onChange: setStatusFilter,
              options: allOf([
                { value: "planned", label: "Planned" },
                { value: "in-progress", label: "In Progress" },
                { value: "done", label: "Done" },
              ]),
            },
          ]}
          summary={`${filteredComponents.length} of ${mod.components.length}`}
        />
      )}

      <div className="mt-6">
        {mod.components.length === 0 ? (
          <EmptyState>
            No components yet. Backlog items attach to components, so add these first.
          </EmptyState>
        ) : filteredComponents.length === 0 ? (
          <EmptyState>No components match the filters.</EmptyState>
        ) : (
          <DataTable
            headers={["Component", "Owner", "Sprints", "Backlog Items", "Status", ""]}
          >
            {filteredComponents.map((component) => {
              const items = moduleBacklog.filter(
                (b) => b.componentId === component.id
              );
              const componentSprints = sprints.filter(
                (s) => s.moduleId === mod.id && s.componentId === component.id
              );
              return (
                <tr key={component.id} className="group">
                  <td className="py-4 pr-6">
                    <Link
                      href={componentPath(mod, component.id)}
                      className="font-medium text-ink hover:underline"
                    >
                      {component.name}
                    </Link>
                  </td>
                  <td className="py-4 pr-6 text-muted">{component.owner}</td>
                  <td className="py-4 pr-6 tabular-nums">{componentSprints.length}</td>
                  <td className="py-4 pr-6 tabular-nums">
                    {items.length}
                    {items.length > 0 && (
                      <span className="ml-2 text-xs text-muted">
                        ({items.filter((i) => i.readiness === "ready").length} ready)
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-6">
                    <button
                      onClick={() => cycleStatus(component.id)}
                      aria-label={`Change status — currently ${component.status}`}
                      title="Click to change status"
                      className="hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    >
                      <StatusPill status={component.status} />
                    </button>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(component)}
                        className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                      >
                        Edit
                      </button>
                      <ConfirmButton onConfirm={() => removeComponent(component.id)} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </div>
  );
}
