"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/Document";
import { Button, PageContainer, PageHeader, Select, inputClass } from "@/components/ui";
import { projectPath } from "@/lib/data";
import { newId, usePrototype } from "@/lib/store";
import type { Client, Module, Project } from "@/lib/types";

const steps = ["Client", "Project", "Modules", "Review"];

const today = () => new Date().toISOString().slice(0, 10);

interface ModuleDraft {
  key: string;
  name: string;
  goal: string;
  /** Comma-separated; each becomes a component. */
  components: string;
}

const blankModule = (): ModuleDraft => ({
  key: newId("draft"),
  name: "",
  goal: "",
  components: "",
});

const splitComponents = (raw: string) =>
  raw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

/**
 * Starting a project used to take four pages: create the client, open it, add
 * the project, open that, add each module, open each one, add its components.
 * This walks the same records in one place and creates them together, so a
 * project starts life with the structure it needs instead of an empty table.
 */
export default function NewProjectWizard({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: presetClientId } = use(searchParams);
  const router = useRouter();
  const { clients, masters, clientsCrud, projectsCrud, modulesCrud, showToast } =
    usePrototype();

  const preset = clients.find((c) => c.id === presetClientId);
  const [step, setStep] = useState(0);
  const [clientMode, setClientMode] = useState<"existing" | "new">(
    clients.length === 0 ? "new" : "existing"
  );
  const [clientId, setClientId] = useState(preset?.id ?? clients[0]?.id ?? "");
  const [newClient, setNewClient] = useState({
    name: "",
    industry: masters.industries[0] ?? "",
    contractType: masters.contractTypes[0] ?? "",
  });
  const [project, setProject] = useState({
    name: "",
    objective: "",
    startDate: today(),
  });
  const [mods, setMods] = useState<ModuleDraft[]>([blankModule()]);

  const existingClient = clients.find((c) => c.id === clientId);
  const clientName =
    clientMode === "new" ? newClient.name.trim() : existingClient?.name ?? "";
  const namedModules = mods.filter((m) => m.name.trim());

  const stepReady = [
    clientMode === "new" ? Boolean(newClient.name.trim()) : Boolean(existingClient),
    Boolean(project.name.trim()) && Boolean(project.startDate),
    namedModules.length > 0,
    true,
  ];

  const patchModule = (key: string, changes: Partial<ModuleDraft>) =>
    setMods((prev) => prev.map((m) => (m.key === key ? { ...m, ...changes } : m)));

  const create = () => {
    let client: Client | undefined = existingClient;
    if (clientMode === "new") {
      client = {
        id: newId("client"),
        name: newClient.name.trim(),
        industry: newClient.industry,
        contractType: newClient.contractType,
        clientPic: "",
        status: "active",
        witOwner: "Fahmi",
        health: "healthy",
        risk: "low",
        notes: "",
        actionNeeded: [],
        aiInsight: "New client — no delivery signals yet.",
      };
      clientsCrud.add(client);
    }
    if (!client) return;

    const created: Project = {
      id: newId("project"),
      clientId: client.id,
      name: project.name.trim(),
      objective: project.objective.trim() || "Objective to be defined.",
      startDate: project.startDate,
      status: "discovery",
    };
    projectsCrud.add(created);

    for (const draft of namedModules) {
      const mod: Module = {
        id: newId("module"),
        projectId: created.id,
        clientId: client.id,
        name: draft.name.trim(),
        goal: draft.goal.trim() || "Module goal to be defined.",
        owner: client.clientPic,
        deliveryLead: "Fahmi",
        status: "discovery",
        health: 100,
        risk: "low",
        velocity: 0,
        blockedCount: 0,
        components: splitComponents(draft.components).map((name) => ({
          id: newId("component"),
          name,
          owner: "",
          status: "planned",
        })),
        currentSprintId: undefined,
        aiInsight: {
          insight: "New module — start by building the initial backlog.",
          reason: "No delivery data exists yet.",
          recommendations: ["Add backlog items, then plan the first sprint"],
          confidence: "high",
        },
      };
      modulesCrud.add(mod);
    }

    showToast(
      `${created.name} created with ${namedModules.length} module${namedModules.length === 1 ? "" : "s"}.`,
      "success"
    );
    router.push(projectPath(created));
  };

  return (
    <PageContainer>
      <PageHeader
        eyebrow="New Project"
        title="Start a project"
        description="Client, project and its modules in one pass. Everything here can be edited later."
      />

      <div className="mt-10 grid gap-10 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
        <ol className="flex gap-1 overflow-x-auto pb-1 md:block md:pb-0">
          {steps.map((label, i) => (
            <li key={label} className="shrink-0 md:shrink">
              <button
                onClick={() => i < step && setStep(i)}
                disabled={i > step}
                aria-current={i === step ? "step" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-left text-sm transition-colors md:w-full md:gap-3 md:border-b-0 md:border-l-2 md:py-3 md:pl-4 ${
                  i === step
                    ? "border-accent font-semibold text-ink"
                    : i < step
                      ? "border-line text-muted hover:text-ink"
                      : "border-line text-line"
                }`}
              >
                <span className="text-xs tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                {label}
              </button>
            </li>
          ))}
        </ol>

        <div className="max-w-2xl">
          {step === 0 && (
            <section>
              <h3 className="text-xl font-semibold tracking-tight text-ink">Who is it for?</h3>
              <div className="mt-6 flex gap-2" role="radiogroup" aria-label="Client">
                {(["existing", "new"] as const).map((mode) => (
                  <Button
                    key={mode}
                    role="radio"
                    aria-checked={clientMode === mode}
                    variant={clientMode === mode ? "primary" : "secondary"}
                    size="sm"
                    disabled={mode === "existing" && clients.length === 0}
                    onClick={() => setClientMode(mode)}
                  >
                    {mode === "existing" ? "Existing client" : "New client"}
                  </Button>
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {clientMode === "existing" ? (
                  <Field label="Client">
                    <Select value={clientId} onChange={setClientId}>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <>
                    <Field label="Client Name">
                      <input
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        className={inputClass}
                        placeholder="e.g. PT Astra Components"
                      />
                    </Field>
                    <Field label="Industry">
                      <Select
                        value={newClient.industry}
                        onChange={(industry) => setNewClient({ ...newClient, industry })}
                      >
                        {masters.industries.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Contract Type">
                      <Select
                        value={newClient.contractType}
                        onChange={(contractType) => setNewClient({ ...newClient, contractType })}
                      >
                        {masters.contractTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </>
                )}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h3 className="text-xl font-semibold tracking-tight text-ink">The project</h3>
              <p className="mt-1 text-sm text-muted">
                Its start date decides which year folder it files under.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Project Name">
                  <input
                    value={project.name}
                    onChange={(e) => setProject({ ...project, name: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Warehouse Digitalization"
                  />
                </Field>
                <Field label="Start Date">
                  <input
                    type="date"
                    value={project.startDate}
                    onChange={(e) => setProject({ ...project, startDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Field label="Objective">
                  <textarea
                    value={project.objective}
                    onChange={(e) => setProject({ ...project, objective: e.target.value })}
                    rows={3}
                    className={inputClass}
                    placeholder="What changes for the client when this is done?"
                  />
                </Field>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <h3 className="text-xl font-semibold tracking-tight text-ink">Modules</h3>
              <p className="mt-1 text-sm text-muted">
                At least one. List components separated by commas, or leave them for later.
              </p>
              <div className="mt-6 space-y-4">
                {mods.map((m, i) => (
                  <div key={m.key} className="rounded-card bg-card shadow-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="label">Module {i + 1}</span>
                      {mods.length > 1 && (
                        <button
                          onClick={() => setMods((prev) => prev.filter((x) => x.key !== m.key))}
                          className="text-xs text-muted hover:text-danger"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      <Field label={`Module ${i + 1} Name`}>
                        <input
                          value={m.name}
                          onChange={(e) => patchModule(m.key, { name: e.target.value })}
                          className={inputClass}
                          placeholder="e.g. Inventory Tracking"
                        />
                      </Field>
                      <Field label={`Module ${i + 1} Goal`}>
                        <input
                          value={m.goal}
                          onChange={(e) => patchModule(m.key, { goal: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <div className="mt-4">
                      <Field label={`Module ${i + 1} Components`}>
                        <input
                          value={m.components}
                          onChange={(e) => patchModule(m.key, { components: e.target.value })}
                          className={inputClass}
                          placeholder="e.g. Barcode scan, Stock ledger, Reorder alerts"
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => setMods((prev) => [...prev, blankModule()])}
              >
                Add another module
              </Button>
            </section>
          )}

          {step === 3 && (
            <section>
              <h3 className="text-xl font-semibold tracking-tight text-ink">Review</h3>
              <dl className="mt-6 divide-y divide-border rounded-card bg-card px-5 shadow-card text-sm">
                <div className="flex gap-6 py-3">
                  <dt className="w-28 shrink-0 text-muted">Client</dt>
                  <dd className="text-ink">
                    {clientName}
                    {clientMode === "new" && <span className="ml-2 text-xs text-muted">(new)</span>}
                  </dd>
                </div>
                <div className="flex gap-6 py-3">
                  <dt className="w-28 shrink-0 text-muted">Project</dt>
                  <dd className="text-ink">
                    {project.name.trim()}
                    <span className="ml-2 text-xs text-muted">starts {project.startDate}</span>
                  </dd>
                </div>
                <div className="flex gap-6 py-3">
                  <dt className="w-28 shrink-0 text-muted">Modules</dt>
                  <dd>
                    <ul className="space-y-1 text-ink">
                      {namedModules.map((m) => {
                        const comps = splitComponents(m.components);
                        return (
                          <li key={m.key}>
                            {m.name.trim()}
                            {comps.length > 0 && (
                              <span className="ml-2 text-xs text-muted">
                                {comps.length} component{comps.length === 1 ? "" : "s"}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <div className="mt-10 flex gap-2">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button disabled={!stepReady[step]} onClick={() => setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button onClick={create}>Create Project</Button>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
