import { clientPath, modulePath, projectPath } from "./data";
import type { Client, Module, Project } from "./types";

/**
 * The Client → Project → Module ids a URL resolves to.
 *
 * Walks by segment name rather than by position, because the routes below a
 * module vary in depth (`…/modules/x`, `…/modules/x/backlog`,
 * `…/modules/x/sprints/y/board`) and positional indexing would only work for
 * one of them.
 */
export interface HierarchyPath {
  clientId?: string;
  projectId?: string;
  moduleId?: string;
}

export function parseHierarchyPath(pathname: string): HierarchyPath {
  const segs = pathname.split("/").filter(Boolean);
  if (segs[0] !== "clients" || !segs[1]) return {};

  const at = (name: string) => {
    const i = segs.indexOf(name);
    return i >= 0 ? segs[i + 1] : undefined;
  };
  return {
    clientId: segs[1],
    projectId: at("projects"),
    moduleId: at("modules"),
  };
}

/**
 * `current` is the row you are on; `ancestor` is a row you are inside.
 * The distinction is what stops every row on the spine reading as selected.
 */
export type RowState = "current" | "ancestor";

export interface BranchRow {
  href: string;
  label: string;
  state: RowState | null;
  ariaCurrent?: "page" | "true";
}

export interface BranchOverflow {
  hiddenCount: number;
  total: number;
  noun: "projects" | "modules";
  parentName: string;
  href: string;
  /** True when that href is the page you are already on. */
  isCurrentPage: boolean;
}

export interface BranchList {
  label: string;
  rows: BranchRow[];
  overflow: BranchOverflow | null;
}

export interface Branch {
  client: BranchRow;
  clientName: string;
  projects: BranchList;
  modules: BranchList | null;
  /** href of the current row, so the sidebar can scroll it into view. */
  currentKey: string | null;
}

/** How many siblings the rail shows before it starts hiding them. */
export const BRANCH_WINDOW = 5;

/**
 * A window of `BRANCH_WINDOW` rows that always contains the current one.
 *
 * This is the whole reason the sidebar's height is a constant: a client with
 * forty projects contributes the same five rows as a client with five.
 */
export function windowAround(total: number, currentIndex: number) {
  if (total <= BRANCH_WINDOW) return { start: 0, end: total };
  const start =
    currentIndex < 0
      ? 0
      : Math.min(Math.max(currentIndex - 2, 0), total - BRANCH_WINDOW);
  return { start, end: start + BRANCH_WINDOW };
}

const rowState = (
  pathname: string,
  href: string,
  /** Spine rows go `ancestor` on a deeper URL; leaf rows stay `current`. */
  spine: boolean
): Pick<BranchRow, "state" | "ariaCurrent"> => {
  if (pathname === href) return { state: "current", ariaCurrent: "page" };
  if (pathname.startsWith(href + "/")) {
    return spine
      ? { state: "ancestor" }
      : { state: "current", ariaCurrent: "true" };
  }
  return { state: null };
};

function buildList(
  label: string,
  items: { href: string; label: string }[],
  pathname: string,
  overflow: Omit<BranchOverflow, "hiddenCount" | "total" | "isCurrentPage">
): BranchList {
  const currentIndex = items.findIndex(
    (i) => pathname === i.href || pathname.startsWith(i.href + "/")
  );
  const { start, end } = windowAround(items.length, currentIndex);
  const hiddenCount = items.length - (end - start);
  return {
    label,
    rows: items.slice(start, end).map((i) => ({
      href: i.href,
      label: i.label,
      ...rowState(pathname, i.href, false),
    })),
    overflow:
      hiddenCount > 0
        ? {
            ...overflow,
            hiddenCount,
            total: items.length,
            isCurrentPage: pathname === overflow.href,
          }
        : null,
  };
}

/**
 * The branch of the hierarchy the current URL sits in — or null, off the
 * client routes.
 *
 * Deliberately not a tree of everything. The sidebar shows the path you are
 * standing in and its immediate siblings, which is bounded at nine rows
 * whether the workspace holds three clients or three hundred. Anything that
 * expands is bounded on arrival but not bounded: one user opening two clients
 * puts it right back where it was.
 */
export function resolveBranch(
  data: { clients: Client[]; projects: Project[]; modules: Module[] },
  pathname: string
): Branch | null {
  const { clientId, projectId } = parseHierarchyPath(pathname);
  if (!clientId) return null;

  const client = data.clients.find((c) => c.id === clientId);
  if (!client) return null;

  // Ids are checked against their parent, so a mismatched or stale URL
  // resolves to nothing rather than to somebody else's project.
  const project = projectId
    ? data.projects.find((p) => p.id === projectId && p.clientId === client.id)
    : undefined;
  // A module id is not resolved here on purpose: the modules list below is
  // built from the project, and a stale or foreign module id simply lights
  // nothing rather than rendering a row that belongs to another project.

  const clientHref = clientPath(client.id);
  const clientRow: BranchRow = {
    href: clientHref,
    label: client.name,
    ...rowState(pathname, clientHref, true),
  };

  // Inside a project, the projects list narrows to the one you are in, and the
  // modules list opens beneath it. Otherwise the projects list is the siblings.
  const projects: BranchList = project
    ? {
        label: `Projects in ${client.name}`,
        rows: [
          {
            href: projectPath(project),
            label: project.name,
            ...rowState(pathname, projectPath(project), true),
          },
        ],
        overflow: null,
      }
    : buildList(
        `Projects in ${client.name}`,
        data.projects
          .filter((p) => p.clientId === client.id)
          // Newest first, matching the year folders on the client page.
          .sort((a, b) => b.startDate.localeCompare(a.startDate))
          .map((p) => ({ href: projectPath(p), label: p.name })),
        pathname,
        { noun: "projects", parentName: client.name, href: clientHref }
      );

  const modules: BranchList | null = project
    ? buildList(
        `Modules in ${project.name}`,
        // Store order, matching the module list on the project page. If that
        // list is ever sorted, sort it identically here — the two are visible
        // on the same screen and would otherwise disagree.
        data.modules
          .filter((m) => m.projectId === project.id)
          .map((m) => ({ href: modulePath(m), label: m.name })),
        pathname,
        { noun: "modules", parentName: project.name, href: projectPath(project) }
      )
    : null;

  const currentKey =
    [clientRow, ...projects.rows, ...(modules?.rows ?? [])].find(
      (r) => r.state === "current"
    )?.href ?? null;

  return {
    client: clientRow,
    clientName: client.name,
    projects,
    modules,
    currentKey,
  };
}
