import { describe, expect, it } from "vitest";
import {
  backlog,
  clients,
  masterLists,
  members,
  products,
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
  const productIds = new Set(products.map((p) => p.id));
  const memberIds = new Set(members.map((m) => m.id));
  const sprintIds = new Set(sprints.map((s) => s.id));
  const backlogIds = new Set(backlog.map((b) => b.id));

  it("projects reference existing clients", () => {
    projects.forEach((p) => expect(clientIds).toContain(p.clientId));
  });

  it("products reference existing projects and clients", () => {
    products.forEach((p) => {
      expect(projectIds).toContain(p.projectId);
      expect(clientIds).toContain(p.clientId);
    });
  });

  it("products' currentSprintId points at a real sprint of that product", () => {
    products
      .filter((p) => p.currentSprintId)
      .forEach((p) => {
        const sprint = sprints.find((s) => s.id === p.currentSprintId);
        expect(sprint, `${p.name} currentSprintId`).toBeTruthy();
        expect(sprint?.productId).toBe(p.id);
      });
  });

  it("sprints reference existing products and members", () => {
    sprints.forEach((s) => {
      expect(productIds).toContain(s.productId);
      s.members.forEach((m) => expect(memberIds).toContain(m.memberId));
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

  it("backlog items reference existing products and their modules", () => {
    backlog.forEach((b) => {
      const product = products.find((p) => p.id === b.productId);
      expect(product, `${b.title} product`).toBeTruthy();
      expect(
        product?.modules.some((m) => m.id === b.moduleId),
        `${b.title} module ${b.moduleId}`
      ).toBe(true);
    });
  });

  it("report queue seeds reference existing products", () => {
    reportQueueSeed.forEach((q) => expect(productIds).toContain(q.productId));
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
