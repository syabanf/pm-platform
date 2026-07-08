"use client";

import { use, useState } from "react";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Field } from "@/components/Document";
import { Button, EmptyState, Input, Panel, SectionHeader } from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";

export default function ModulesPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = use(params);
  const { products, backlog, productsCrud, showToast } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", owner: "" });

  const product = products.find((p) => p.id === productId);
  if (!product) return null;
  const productBacklog = backlog.filter((b) => b.productId === productId);

  const addModule = () => {
    if (!draft.name.trim()) {
      showToast("Module name is required.", "warning");
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
    showToast("Module added.", "success");
  };

  const removeModule = (moduleId: string) => {
    productsCrud.update(product.id, {
      modules: product.modules.filter((m) => m.id !== moduleId),
    });
    showToast("Module removed.", "info");
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
        title="Modules"
        description="Functional parts of the product. Click a status to change it."
        actions={
          <Button size="sm" onClick={() => setPanelOpen(!panelOpen)}>
            Add Module
          </Button>
        }
      />

      {panelOpen && (
        <Panel className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Module Name">
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
            <Button onClick={addModule}>Add Module</Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <div className="mt-6">
        {product.modules.length === 0 ? (
          <EmptyState>
            No modules yet. Backlog items attach to modules, so add these first.
          </EmptyState>
        ) : (
          <DataTable headers={["Module", "Owner", "Backlog Items", "Status", ""]}>
            {product.modules.map((module) => {
              const items = productBacklog.filter(
                (b) => b.moduleId === module.id
              );
              return (
                <tr key={module.id} className="group">
                  <td className="py-4 pr-6 font-medium text-ink">{module.name}</td>
                  <td className="py-4 pr-6 text-muted">{module.owner}</td>
                  <td className="py-4 pr-6 tabular-nums">
                    {items.length}
                    {items.length > 0 && (
                      <span className="ml-2 text-xs text-muted">
                        ({items.filter((i) => i.readiness === "ready").length} ready)
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-6">
                    <button onClick={() => cycleStatus(module.id)} title="Click to change status">
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
