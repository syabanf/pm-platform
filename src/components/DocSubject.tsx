"use client";

import { useState } from "react";
import { Field } from "@/components/Document";
import { Select } from "@/components/ui";
import { usePrototype } from "@/lib/store";
import type { Client, Module, Project } from "@/lib/types";

export interface DocSubject {
  client?: Client;
  project?: Project;
  module?: Module;
  clientId: string;
  projectId: string;
  moduleId: string;
  setClientId: (id: string) => void;
  setProjectId: (id: string) => void;
  setModuleId: (id: string) => void;
  clientOptions: Client[];
  projectOptions: Project[];
  moduleOptions: Module[];
}

/**
 * Who a generated document is about: client → project → module.
 *
 * Reads the live store, not the seed in `@/lib/data`. Every generator used to
 * import the fixture arrays directly, so a client added in the app never showed
 * up in a document — the lists were frozen at build time.
 *
 * The cascade holds without effects. Each id is a *preference*: if the stored
 * project does not belong to the selected client, the first one that does is
 * used instead. That means changing the client needs no reset, and there is no
 * render where the project shown belongs to a different client.
 */
export function useDocSubject(): DocSubject {
  const { clients, projects, modules } = usePrototype();

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [moduleId, setModuleId] = useState("");

  const client = clients.find((c) => c.id === clientId) ?? clients[0];
  const projectOptions = projects.filter((p) => p.clientId === client?.id);
  const project =
    projectOptions.find((p) => p.id === projectId) ?? projectOptions[0];
  const moduleOptions = modules.filter((m) => m.projectId === project?.id);
  const mod = moduleOptions.find((m) => m.id === moduleId) ?? moduleOptions[0];

  return {
    client,
    project,
    module: mod,
    clientId: client?.id ?? "",
    projectId: project?.id ?? "",
    moduleId: mod?.id ?? "",
    setClientId,
    setProjectId,
    setModuleId,
    clientOptions: clients,
    projectOptions,
    moduleOptions,
  };
}

/**
 * The subject fields, identical across every generator. `withModule` adds the
 * third level for documents whose content is module-scoped — a status update or
 * a UAT sign-off — and is left off for ones that are about the project as a
 * whole.
 */
export function DocSubjectFields({
  subject,
  withModule = false,
}: {
  subject: DocSubject;
  withModule?: boolean;
}) {
  return (
    <>
      <Field label="Client">
        <Select value={subject.clientId} onChange={subject.setClientId}>
          {subject.clientOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Project">
        <Select
          value={subject.projectId}
          onChange={subject.setProjectId}
          placeholder={
            subject.projectOptions.length === 0
              ? "No projects for this client"
              : "Select project…"
          }
        >
          {subject.projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      {withModule && (
        <Field label="Module">
          <Select
            value={subject.moduleId}
            onChange={subject.setModuleId}
            placeholder={
              subject.moduleOptions.length === 0
                ? "No modules in this project"
                : "Select module…"
            }
          >
            {subject.moduleOptions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </>
  );
}
