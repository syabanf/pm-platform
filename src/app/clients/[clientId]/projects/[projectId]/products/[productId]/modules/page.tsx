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
import { modulePath } from "@/lib/data";
import { newId, usePrototype } from "@/lib/store";

export default function ModulesPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const {
    products,
    backlog,
    sprints,
    tasks,
    productsCrud,
    sprintsCrud,
    tasksCrud,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", owner: "" });
  const [statusFilter, setStatusFilter] = useState("all");

  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  const productBacklog = backlog.filter((b) => b.productId === productId);
  const filteredModules = product.modules.filter(
    (m) => statusFilter === "all" || m.status === statusFilter
  );

  const addModule = () => {
    if (!draft.name.trim()) {
      showToast("Component name is required.", "warning");
      return;
    }
    productsCrud.update(product.id, {
      modules: [
        ...product.modules,
        {
          id: newId("module"),
          name: draft.name.trim(),
          owner: draft.owner.trim() || "Unassigned",
          status: "planned",
        },
      ],
    });
    setDraft({ name: "", owner: "" });
    setPanelOpen(false);
    showToast("Component added.", "success");
  };

  const removeModule = (moduleId: string) => {
    productsCrud.update(product.id, {
      modules: product.modules.filter((m) => m.id !== moduleId),
    });
    const removedSprintIds = sprints
      .filter((s) => s.productId === product.id && s.moduleId === moduleId)
      .map((s) => s.id);
    removedSprintIds.forEach((id) => sprintsCrud.remove(id));
    tasks
      .filter((t) => removedSprintIds.includes(t.sprintId))
      .forEach((t) => tasksCrud.remove(t.id));
    showToast("Component removed.", "info");
  };

  const cycleStatus = (moduleId: string) => {
    const order = ["planned", "in-progress", "done"] as const;
    productsCrud.update(product.id, {
      modules: product.modules.map((m) =>
        m.id === moduleId
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
          <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            Add Component
          </Button>
        }
      />

      {panelOpen && (
        <Panel className="mt-4">
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
            <Button onClick={addModule}>Add Component</Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      {product.modules.length > 0 && (
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
          summary={`${filteredModules.length} of ${product.modules.length}`}
        />
      )}

      <div className="mt-6">
        {product.modules.length === 0 ? (
          <EmptyState>
            No components yet. Backlog items attach to components, so add these first.
          </EmptyState>
        ) : filteredModules.length === 0 ? (
          <EmptyState>No components match the filters.</EmptyState>
        ) : (
          <DataTable
            headers={["Component", "Owner", "Sprints", "Backlog Items", "Status", ""]}
          >
            {filteredModules.map((module) => {
              const items = productBacklog.filter(
                (b) => b.moduleId === module.id
              );
              const moduleSprints = sprints.filter(
                (s) => s.productId === product.id && s.moduleId === module.id
              );
              return (
                <tr key={module.id} className="group">
                  <td className="py-4 pr-6">
                    <Link
                      href={modulePath(product, module.id)}
                      className="font-medium text-ink hover:underline"
                    >
                      {module.name}
                    </Link>
                  </td>
                  <td className="py-4 pr-6 text-muted">{module.owner}</td>
                  <td className="py-4 pr-6 tabular-nums">{moduleSprints.length}</td>
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
                      onClick={() => cycleStatus(module.id)}
                      aria-label={`Change status — currently ${module.status}`}
                      title="Click to change status"
                      className="hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                    >
                      <StatusPill status={module.status} />
                    </button>
                  </td>
                  <td className="py-4 text-right">
                    <div className="opacity-0 transition-opacity group-hover:opacity-100">
                      <ConfirmButton onConfirm={() => removeModule(module.id)} />
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
