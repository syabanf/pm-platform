import { describe, expect, it } from "vitest";
import {
  BRANCH_WINDOW,
  parseHierarchyPath,
  resolveBranch,
  windowAround,
} from "./hierarchy";
import { clients, modules, projects } from "./data";

const data = { clients, projects, modules };

describe("parseHierarchyPath", () => {
  it("reads ids by segment name, at every depth", () => {
    expect(parseHierarchyPath("/clients/ubs-gold")).toEqual({
      clientId: "ubs-gold",
      projectId: undefined,
      moduleId: undefined,
    });
    expect(
      parseHierarchyPath(
        "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board"
      )
    ).toEqual({
      clientId: "ubs-gold",
      projectId: "ubs-mdt",
      moduleId: "oee-intelligence",
    });
  });

  it("is empty off the client routes", () => {
    for (const path of ["/", "/reports", "/settings/masters/jobRoles", "/clients"]) {
      expect(parseHierarchyPath(path), path).toEqual({});
    }
  });
});

describe("windowAround", () => {
  it("shows everything when it fits", () => {
    for (let n = 0; n <= BRANCH_WINDOW; n++) {
      expect(windowAround(n, -1), `n=${n}`).toEqual({ start: 0, end: n });
    }
  });

  it("always contains the current row, wherever it is", () => {
    // The whole point of the window: the row you are on is never the one that
    // got hidden. 40 is a workspace nobody would page through by hand.
    for (const total of [6, 7, 40]) {
      for (let current = 0; current < total; current++) {
        const { start, end } = windowAround(total, current);
        expect(end - start, `${total}/${current}`).toBe(BRANCH_WINDOW);
        expect(current, `${total}/${current}`).toBeGreaterThanOrEqual(start);
        expect(current, `${total}/${current}`).toBeLessThan(end);
      }
    }
  });

  it("stays inside the list at both ends", () => {
    expect(windowAround(40, 0)).toEqual({ start: 0, end: 5 });
    expect(windowAround(40, 39)).toEqual({ start: 35, end: 40 });
  });

  it("starts at the top when nothing is current", () => {
    expect(windowAround(40, -1)).toEqual({ start: 0, end: 5 });
  });
});

describe("resolveBranch", () => {
  const DEEP =
    "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board";

  it("is null off the client routes", () => {
    for (const path of ["/", "/reports", "/clients", "/documents/mom"]) {
      expect(resolveBranch(data, path), path).toBeNull();
    }
  });

  it("marks the spine as ancestor and the module as current", () => {
    const branch = resolveBranch(data, DEEP)!;
    expect(branch.client.state).toBe("ancestor");
    expect(branch.client.ariaCurrent).toBeUndefined();
    expect(branch.projects.rows).toHaveLength(1);
    expect(branch.projects.rows[0].state).toBe("ancestor");

    const current = branch.modules!.rows.find((r) => r.state === "current");
    // Deeper than the module row, so "true" rather than "page" — the module is
    // the deepest level the rail renders.
    expect(current?.ariaCurrent).toBe("true");
    expect(current?.label).toBe("OEE Intelligence Platform");
  });

  it("says page, not true, when you are on the row itself", () => {
    const branch = resolveBranch(
      data,
      "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence"
    )!;
    const current = branch.modules!.rows.find((r) => r.state === "current");
    expect(current?.ariaCurrent).toBe("page");
  });

  it("shows a client's projects, and no modules, on the client page", () => {
    const branch = resolveBranch(data, "/clients/ubs-gold")!;
    expect(branch.client.ariaCurrent).toBe("page");
    expect(branch.modules).toBeNull();
    expect(branch.projects.rows.length).toBeGreaterThan(0);
  });

  it("stays bounded however big the workspace gets", () => {
    // 40 projects and 40 modules under one client — the case the seed cannot
    // reach and the reason the window exists at all.
    const big = {
      clients,
      projects: [
        ...projects,
        ...Array.from({ length: 40 }, (_, i) => ({
          ...projects[0],
          id: `p${i}`,
          name: `Project ${i}`,
          startDate: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
        })),
      ],
      modules: [
        ...modules,
        ...Array.from({ length: 40 }, (_, i) => ({
          ...modules[0],
          id: `m${i}`,
          name: `Module ${i}`,
          projectId: "ubs-mdt",
        })),
      ],
    };
    const onClient = resolveBranch(big, "/clients/ubs-gold")!;
    expect(onClient.projects.rows).toHaveLength(BRANCH_WINDOW);
    expect(onClient.projects.overflow?.total).toBe(41);
    // Standing on the client page, the "see all" link would point at the page
    // you are already on — so it is text, not a link.
    expect(onClient.projects.overflow?.isCurrentPage).toBe(true);

    const inProject = resolveBranch(
      big,
      "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence"
    )!;
    expect(inProject.projects.rows).toHaveLength(1);
    expect(inProject.modules!.rows).toHaveLength(BRANCH_WINDOW);
    expect(inProject.modules!.overflow?.isCurrentPage).toBe(false);
    // Nine rows: one client, one project, five modules, one overflow.
    const total =
      1 +
      inProject.projects.rows.length +
      inProject.modules!.rows.length +
      (inProject.modules!.overflow ? 1 : 0);
    expect(total).toBe(8);
  });

  it("resolves nothing for a project that belongs to another client", () => {
    expect(
      resolveBranch(data, "/clients/bni/projects/ubs-mdt")!.projects.rows.length
    ).toBeGreaterThan(0);
    // BNI's own projects, not UBS's — the mismatched id is ignored.
    const branch = resolveBranch(data, "/clients/bni/projects/ubs-mdt")!;
    expect(branch.modules).toBeNull();
  });

  it("is null for a client that does not exist", () => {
    expect(resolveBranch(data, "/clients/nope/projects/x")).toBeNull();
  });
});
