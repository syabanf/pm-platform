"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { DataTable } from "@/components/DataTable";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Folder, groupBy } from "@/components/Folder";
import { Field, inputClass } from "@/components/Document";
import {
  PageContainer,
  PageHeader,
  Panel,
  Button,
  ToggleButton,
  FilterBar,
  EmptyState,
  allOf,
  Select,
} from "@/components/ui";
import { newId, usePrototype } from "@/lib/store";
import type { Client } from "@/lib/types";

const emptyDraft = {
  name: "",
  industry: "",
  clientPic: "",
  contractType: "Retainer",
};

export default function ClientsPage() {
  const {
    clients,
    projects,
    modules,
    clientsCrud,
    removeClientCascade,
    masters,
    showToast,
  } = usePrototype();
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [statusFilter, setStatusFilter] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  const filteredClients = clients.filter(
    (client) =>
      (statusFilter === "all" || client.status === statusFilter) &&
      (healthFilter === "all" || client.health === healthFilter) &&
      (riskFilter === "all" || client.risk === riskFilter)
  );

  // A directory, not one long table: clients group into industry folders, so
  // the page stays readable as the list grows past what anyone can scan.
  // Industries sort alphabetically; a client with none lands in "Uncategorised",
  // which sorts last rather than pretending to be a real industry.
  const UNCATEGORISED = "Uncategorised";
  const byIndustry = groupBy(
    filteredClients,
    (c) => c.industry?.trim() || UNCATEGORISED,
    (a, b) =>
      a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b)
  );

  // Every folder starts open: with a handful of industries that is the same
  // page as before, and it only starts folding once there is enough to fold.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const openIndustries = {
    has: (industry: string) => !collapsed.has(industry),
  };
  const toggleIndustry = (industry: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(industry)) next.delete(industry);
      else next.add(industry);
      return next;
    });

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setPanelOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingId(client.id);
    setDraft({
      name: client.name,
      industry: client.industry,
      clientPic: client.clientPic,
      contractType: client.contractType,
    });
    setPanelOpen(true);
  };

  const save = () => {
    if (!draft.name.trim()) {
      showToast("Client name is required.", "warning");
      return;
    }
    if (editingId) {
      clientsCrud.update(editingId, draft);
      showToast("Client updated.", "success");
    } else {
      clientsCrud.add({
        id: newId("client"),
        ...draft,
        status: "active",
        witOwner: "Fahmi",
        health: "healthy",
        risk: "low",
        notes: "",
        actionNeeded: [],
        aiInsight: "New client — no delivery signals yet.",
      });
      showToast("Client created. Add a project to start delivery.", "success");
    }
    setPanelOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Clients"
        title="All Clients"
        description={`${clients.length} active clients across the portfolio.`}
        actions={<Button onClick={openCreate}>Add Client</Button>}
      />

      {panelOpen && (
        <Panel title={editingId ? "Edit Client" : "New Client"} className="mt-8">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client Name">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputClass}
                placeholder="e.g. PT Astra Components"
              />
            </Field>
            <Field label="Industry">
              <Select
                value={draft.industry}
                onChange={(value) => setDraft({ ...draft, industry: value })}
              >
                <option value="">Select industry…</option>
                {masters.industries.map((industry) => (
                  <option key={industry} value={industry}>
                    {industry}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Client PIC">
              <input
                value={draft.clientPic}
                onChange={(e) => setDraft({ ...draft, clientPic: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Contract Type">
              <div className="flex flex-wrap gap-1.5">
                {masters.contractTypes.map((t) => (
                  <ToggleButton
                    key={t}
                    active={draft.contractType === t}
                    size="md"
                    onClick={() => setDraft({ ...draft, contractType: t })}
                  >
                    {t}
                  </ToggleButton>
                ))}
              </div>
            </Field>
          </div>
          <div className="mt-5 flex gap-2">
            <Button onClick={save}>
              {editingId ? "Save Changes" : "Create Client"}
            </Button>
            <Button variant="secondary" onClick={() => setPanelOpen(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      )}

      <FilterBar
        className="mt-10"
        groups={[
          {
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: allOf([
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "prospect", label: "Prospect" },
            ]),
          },
          {
            label: "Health",
            value: healthFilter,
            onChange: setHealthFilter,
            options: allOf([
              { value: "healthy", label: "Healthy" },
              { value: "warning", label: "Warning" },
              { value: "at-risk", label: "At Risk" },
            ]),
          },
          {
            label: "Risk",
            value: riskFilter,
            onChange: setRiskFilter,
            options: allOf([
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]),
          },
        ]}
        summary={`${filteredClients.length} of ${clients.length}`}
      />

      <div className="mt-10 space-y-3">
        {filteredClients.length === 0 && (
          <EmptyState>No clients match the filters.</EmptyState>
        )}
        {byIndustry.map(([industry, group]) => (
          <Folder
            key={industry}
            label={industry}
            count={group.length}
            open={openIndustries.has(industry)}
            onToggle={() => toggleIndustry(industry)}
          >
            <DataTable
              headers={[
                "Client",
                "Projects",
                "Modules",
                "Contract",
                "Health",
                "Risk",
                "",
              ]}
            >
              {group.map((client) => (
                <tr key={client.id} className="group">
                  <td className="py-4 pr-6 font-medium text-ink">
                    <Link
                      href={`/clients/${client.id}`}
                      className="hover:underline"
                    >
                      {client.name}
                    </Link>
                  </td>
                  <td className="py-4 pr-6 tabular-nums">
                    {projects.filter((p) => p.clientId === client.id).length}
                  </td>
                  <td className="py-4 pr-6 tabular-nums">
                    {modules.filter((p) => p.clientId === client.id).length}
                  </td>
                  <td className="py-4 pr-6 text-muted">{client.contractType}</td>
                  <td className="py-4 pr-6">
                    <StatusPill status={client.health} />
                  </td>
                  <td className="py-4 pr-6">
                    <StatusPill status={client.risk} />
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => openEdit(client)}
                        className="border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
                      >
                        Edit
                      </button>
                      <ConfirmButton
                        onConfirm={() => {
                          const undo = removeClientCascade(client.id);
                          showToast(
                            `${client.name} and its projects were removed.`,
                            "info",
                            { label: "Undo", run: undo }
                          );
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Folder>
        ))}
      </div>
    </PageContainer>
  );
}
