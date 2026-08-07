import { describe, expect, it } from "vitest";
import {
  backlog,
  clients,
  masterLists,
  members,
  modules,
  projects,
  reportQueueSeed,
  reportTemplateMaster,
  sprints,
  tasks,
} from "./data";

// Referential integrity of the seed data — a broken reference here means a
// blank screen or a silent lookup miss somewhere in the UI.
describe("seed data integrity", () => {
  const clientIds = new Set(clients.map((c) => c.id));
  const projectIds = new Set(projects.map((p) => p.id));
  const moduleIds = new Set(modules.map((p) => p.id));
  const memberIds = new Set(members.map((m) => m.id));
  const sprintIds = new Set(sprints.map((s) => s.id));
  const backlogIds = new Set(backlog.map((b) => b.id));

  it("projects reference existing clients", () => {
    projects.forEach((p) => expect(clientIds).toContain(p.clientId));
  });

  it("modules reference existing projects and clients", () => {
    modules.forEach((p) => {
      expect(projectIds).toContain(p.projectId);
      expect(clientIds).toContain(p.clientId);
    });
  });

  it("modules' currentSprintId points at a real sprint of that module", () => {
    modules
      .filter((p) => p.currentSprintId)
      .forEach((p) => {
        const sprint = sprints.find((s) => s.id === p.currentSprintId);
        expect(sprint, `${p.name} currentSprintId`).toBeTruthy();
        expect(sprint?.moduleId).toBe(p.id);
      });
  });

  it("sprints reference existing modules and members", () => {
    sprints.forEach((s) => {
      expect(moduleIds).toContain(s.moduleId);
      s.members.forEach((m) => expect(memberIds).toContain(m.memberId));
    });
  });

  it("sprints reference an existing component (moduleId) of their product", () => {
    sprints.forEach((s) => {
      const mod = modules.find((p) => p.id === s.moduleId);
      expect(mod, `sprint ${s.id} product`).toBeTruthy();
      expect(
        mod?.components.some((m) => m.id === s.componentId),
        `sprint ${s.id} component ${s.componentId}`
      ).toBe(true);
    });
  });

  it("sprint backlogItemIds reference existing backlog items", () => {
    sprints.forEach((s) =>
      s.backlogItemIds.forEach((id) => expect(backlogIds).toContain(id))
    );
  });

  it("tasks reference existing sprints, assignees, and backlog items", () => {
    tasks.forEach((t) => {
      expect(sprintIds).toContain(t.sprintId);
      expect(memberIds).toContain(t.assigneeId);
      expect(backlogIds).toContain(t.backlogItemId);
    });
  });

  it("backlog items reference existing modules and their components", () => {
    backlog.forEach((b) => {
      const mod = modules.find((p) => p.id === b.moduleId);
      expect(mod, `${b.title} product`).toBeTruthy();
      expect(
        mod?.components.some((m) => m.id === b.componentId),
        `${b.title} module ${b.componentId}`
      ).toBe(true);
    });
  });

  it("report queue seeds reference existing modules", () => {
    reportQueueSeed.forEach((q) => expect(moduleIds).toContain(q.moduleId));
  });

  it("seed values exist in their master lists", () => {
    clients.forEach((c) =>
      expect(masterLists.industries).toContain(c.industry)
    );
    clients.forEach((c) =>
      expect(masterLists.contractTypes).toContain(c.contractType)
    );
    backlog.forEach((b) =>
      expect(masterLists.workItemTypes).toContain(b.type)
    );
    backlog.forEach((b) =>
      expect(masterLists.priorities).toContain(b.priority)
    );
  });

  it("report templates have unique names and at least one section", () => {
    const names = reportTemplateMaster.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    reportTemplateMaster.forEach((t) =>
      expect(t.sections.length).toBeGreaterThan(0)
    );
  });

  it("sprint capacity math matches the spec example (27.5 mandays)", () => {
    const sprint03 = sprints.find((s) => s.id === "sprint-03")!;
    const capacity = sprint03.members.reduce(
      (sum, m) => sum + m.capacityDays,
      0
    );
    expect(capacity).toBe(27.5);
  });
});
