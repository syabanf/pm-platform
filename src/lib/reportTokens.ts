import type { Client, Module, Project, Sprint } from "./types";

/**
 * Everything a template's prose can refer to.
 *
 * Assembled once per report and handed to `renderTokens`, so a section body
 * written in Settings can say "{{sprint.goal}}" and come out with this sprint's
 * actual goal in it.
 */
export interface ReportContext {
  client?: Client;
  project?: Project;
  module: Module;
  sprint: Sprint;
  metrics: {
    committed: number;
    completed: number;
    completionRate: number;
    inProgress: number;
    blocked: number;
    notCompleted: number;
    openDecisions: number;
    velocity: number;
  };
  preparedBy: string;
}

/** Sprint numbers read as "Sprint 03", never "Sprint 3". */
const sprintNo = (n: number) => String(n).padStart(2, "0");

/**
 * The token catalogue.
 *
 * One list, used by both the resolver and the editor's palette — a token that
 * exists is offered, and a token that is offered resolves. Adding one here is
 * the whole change.
 */
export const REPORT_TOKENS: {
  token: string;
  group: string;
  describe: string;
  resolve: (ctx: ReportContext) => string;
}[] = [
  {
    token: "client.name",
    group: "Client",
    describe: "Client this module belongs to",
    resolve: (c) => c.client?.name ?? "—",
  },
  {
    token: "client.pic",
    group: "Client",
    describe: "Client's person in charge",
    resolve: (c) => c.client?.clientPic ?? "—",
  },
  {
    token: "project.name",
    group: "Client",
    describe: "Project the module sits under",
    resolve: (c) => c.project?.name ?? "—",
  },
  {
    token: "module.name",
    group: "Delivery",
    describe: "Module the report is about",
    resolve: (c) => c.module.name,
  },
  {
    token: "module.goal",
    group: "Delivery",
    describe: "The module's goal",
    resolve: (c) => c.module.goal,
  },
  {
    token: "module.deliveryLead",
    group: "Delivery",
    describe: "Who leads delivery on the module",
    resolve: (c) => c.module.deliveryLead,
  },
  {
    token: "sprint.number",
    group: "Sprint",
    describe: "Sprint number, zero-padded",
    resolve: (c) => sprintNo(c.sprint.number),
  },
  {
    token: "sprint.name",
    group: "Sprint",
    describe: "Sprint name",
    resolve: (c) => c.sprint.name,
  },
  {
    token: "sprint.goal",
    group: "Sprint",
    describe: "The sprint goal",
    resolve: (c) => c.sprint.goal,
  },
  {
    token: "sprint.startDate",
    group: "Sprint",
    describe: "First day of the sprint",
    resolve: (c) => c.sprint.startDate,
  },
  {
    token: "sprint.endDate",
    group: "Sprint",
    describe: "Last day of the sprint",
    resolve: (c) => c.sprint.endDate,
  },
  {
    token: "sprint.daysLeft",
    group: "Sprint",
    describe: "Working days remaining",
    resolve: (c) => String(c.sprint.daysLeft),
  },
  {
    token: "metrics.committed",
    group: "Metrics",
    describe: "Points committed this sprint",
    resolve: (c) => String(c.metrics.committed),
  },
  {
    token: "metrics.completed",
    group: "Metrics",
    describe: "Points completed this sprint",
    resolve: (c) => String(c.metrics.completed),
  },
  {
    token: "metrics.completionRate",
    group: "Metrics",
    describe: "Completed as a percentage of committed",
    resolve: (c) => `${c.metrics.completionRate}%`,
  },
  {
    token: "metrics.inProgress",
    group: "Metrics",
    describe: "Tasks in flight",
    resolve: (c) => String(c.metrics.inProgress),
  },
  {
    token: "metrics.blocked",
    group: "Metrics",
    describe: "Tasks currently blocked",
    resolve: (c) => String(c.metrics.blocked),
  },
  {
    token: "metrics.notCompleted",
    group: "Metrics",
    describe: "Tasks not finished",
    resolve: (c) => String(c.metrics.notCompleted),
  },
  {
    token: "metrics.openDecisions",
    group: "Metrics",
    describe: "Decisions still open on the module",
    resolve: (c) => String(c.metrics.openDecisions),
  },
  {
    token: "metrics.velocity",
    group: "Metrics",
    describe: "The module's velocity",
    resolve: (c) => String(c.metrics.velocity),
  },
  {
    token: "preparedBy",
    group: "Document",
    describe: "Who the report is prepared by",
    resolve: (c) => c.preparedBy,
  },
];

const BY_NAME = new Map(REPORT_TOKENS.map((t) => [t.token, t]));

/** `{{ token.name }}` — whitespace inside the braces is tolerated. */
const TOKEN_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Substitutes every known token in `text`.
 *
 * An unknown token is left on the page exactly as written rather than being
 * replaced with a blank — a typo should be visible in the preview, not silently
 * produce a sentence with a hole in it.
 */
export function renderTokens(text: string, ctx: ReportContext): string {
  return text.replace(TOKEN_PATTERN, (whole, name: string) => {
    const token = BY_NAME.get(name);
    return token ? token.resolve(ctx) : whole;
  });
}

/** The tokens in `text` that no longer exist, so the editor can say so. */
export function unknownTokens(text: string): string[] {
  const found = new Set<string>();
  for (const [, name] of text.matchAll(TOKEN_PATTERN)) {
    if (!BY_NAME.has(name)) found.add(name);
  }
  return [...found];
}
