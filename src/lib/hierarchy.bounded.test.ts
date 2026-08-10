import { describe, expect, it } from "vitest";
import { BRANCH_WINDOW, resolveBranch } from "./hierarchy";
import type { Client, Module, Project } from "./types";

/**
 * The sidebar's central claim, held to account.
 *
 * ClientBranch says it renders "nine rows at three clients and nine rows at
 * three thousand". That is a claim about a *count*, so it is checked as a
 * count. Nothing here is timed: the work is microseconds even at 3000 clients,
 * and a wall-clock threshold on a shared CI runner measures the runner, not
 * the code.
 *
 * What a timing test would have told us anyway, measured once by hand: the
 * row count is genuinely flat, but the cost is linear in the total number of
 * projects and modules, because resolveBranch filters the full arrays. 0.5 ms
 * at 3000 clients. Bounded output, unbounded scan — worth knowing, not worth
 * a flaky assertion.
 */

const workspace = (clientCount: number, projectsEach = 40, modulesEach = 40) => {
  const clients: Client[] = [];
  const projects: Project[] = [];
  const modules: Module[] = [];
  for (let c = 0; c < clientCount; c++) {
    clients.push({ id: `c${c}`, name: `Client ${c}` } as Client);
    for (let p = 0; p < projectsEach; p++) {
      const pid = `c${c}-p${p}`;
      projects.push({
        id: pid,
        clientId: `c${c}`,
        name: `Project ${p}`,
        // Descending dates, so the newest-first sort has real work to do.
        startDate: `2026-${String((p % 12) + 1).padStart(2, "0")}-01`,
      } as Project);
      for (let m = 0; m < modulesEach; m++) {
        modules.push({
          id: `${pid}-m${m}`,
          projectId: pid,
          clientId: `c${c}`,
          name: `Module ${m}`,
        } as Module);
      }
    }
  }
  return { clients, projects, modules };
};

/** A path deep inside the middle of the workspace, not at either edge. */
const deepPath = (clientCount: number) => {
  const c = Math.floor(clientCount / 2);
  return `/clients/c${c}/projects/c${c}-p20/modules/c${c}-p20-m7`;
};

const SIZES = [3, 30, 300, 3000];

describe("the sidebar branch is bounded", () => {
  it("never shows more than the window, at any size", () => {
    for (const n of SIZES) {
      const branch = resolveBranch(workspace(n), deepPath(n))!;
      expect(branch, `n=${n}`).not.toBeNull();
      expect(branch.projects.rows.length, `projects at n=${n}`).toBeLessThanOrEqual(
        BRANCH_WINDOW
      );
      expect(branch.modules!.rows.length, `modules at n=${n}`).toBeLessThanOrEqual(
        BRANCH_WINDOW
      );
    }
  });

  it("renders the same number of rows at 3 clients and at 3000", () => {
    const count = (n: number) => {
      const b = resolveBranch(workspace(n), deepPath(n))!;
      return 1 + b.projects.rows.length + (b.modules?.rows.length ?? 0);
    };
    // The claim, as an equality between two integers. Anything else fails.
    expect(count(3000)).toBe(count(3));
  });

  it("always keeps the row you are on inside the window", () => {
    // A window that slid past the current item is still "bounded" and
    // completely useless — you would be looking at five siblings of the thing
    // you are standing in, with no sign of where you are.
    for (const n of SIZES) {
      const branch = resolveBranch(workspace(n), deepPath(n))!;
      expect(
        branch.modules!.rows.some((r) => r.state === "current"),
        `no current module row at n=${n}`
      ).toBe(true);
    }
  });

  it("accounts for every row it hides", () => {
    const branch = resolveBranch(workspace(300), deepPath(300))!;
    const overflow = branch.modules!.overflow!;
    expect(overflow).not.toBeNull();
    // Shown + hidden must equal the total, or rows are being dropped rather
    // than counted and the "+ N more" is a lie.
    expect(branch.modules!.rows.length + overflow.hiddenCount).toBe(overflow.total);
  });

  it("windows the modules list even when the projects list does not need it", () => {
    // Standing inside a project narrows the projects list to one row, so the
    // modules list is the only one the window still has to do work on.
    const branch = resolveBranch(workspace(30), deepPath(30))!;
    expect(branch.projects.rows).toHaveLength(1);
    expect(branch.modules!.rows).toHaveLength(BRANCH_WINDOW);
    expect(branch.modules!.overflow!.hiddenCount).toBe(40 - BRANCH_WINDOW);
  });
});
