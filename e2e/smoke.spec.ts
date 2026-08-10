import { test, expect } from "./helpers";

/**
 * Every route, loaded, with the console watched.
 *
 * Deliberately shallow and deliberately wide: it asserts almost nothing about
 * what a page says, only that it renders without React throwing, without a
 * hydration mismatch, and without a request failing. That is the class of
 * breakage the feature specs miss, because they each know one page and none of
 * them notices when a different one stops compiling.
 */
const ROUTES = [
  "/",
  "/clients",
  "/clients/ubs-gold",
  "/clients/ubs-gold/projects/ubs-mdt",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/backlog",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/components",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/decisions",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/members",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/reports",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/planning",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/daily",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/burndown",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/review",
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/retro",
  "/clients/ubs-gold/projects/ubs-mdt/modules/ai-qc-camera/sprints/qc-s1/retro",
  "/reports",
  "/documents",
  "/documents/mom",
  "/documents/status-update",
  "/documents/change-request",
  "/documents/uat-signoff",
  "/documents/kickoff",
  "/ai-coach",
  "/profile",
  "/settings",
  "/settings/members",
  "/settings/roles",
  "/settings/report-templates",
  "/settings/masters",
  "/settings/masters/jobRoles",
  "/settings/dod",
];

for (const route of ROUTES) {
  test(`no console errors on ${route}`, async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) =>
      problems.push(`request failed: ${r.url()}`)
    );

    await page.goto(route);
    await expect(page.locator("#main-content")).toBeVisible();
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
