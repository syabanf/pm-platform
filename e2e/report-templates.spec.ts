import { test, expect, choose, openPalette } from "./helpers";

const REPORTS =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/reports";

const generate = async (page: import("@playwright/test").Page, template: string) => {
  await page.goto(REPORTS);
  // The template button carries its audience as a second line, so its
  // accessible name is "Client Facing Client stakeholders".
  await page.getByRole("button", { name: new RegExp(`^${template}\\b`) }).click();
  await page.getByRole("button", { name: "Generate Report" }).click();
};

test("a report's sections come from its template", async ({ page }) => {
  await generate(page, "Client Facing");
  const headings = page.locator("#main-content article h3");
  await expect(headings).toHaveText([
    "1. Executive Summary",
    "2. Completed Scope",
    "3. Demo Result",
    "4. Pending Decisions",
    "5. Risks Requiring Client Action",
    "6. Next Sprint Plan",
  ]);
});

test("narrative tokens resolve against the sprint being reported on", async ({
  page,
}) => {
  await generate(page, "Client Facing");
  const summary = page.locator("#main-content article section").first();
  // The template says "Sprint {{sprint.number}}" and "{{metrics.committed}}".
  await expect(summary).toContainText("Sprint 03");
  await expect(summary).toContainText("42 committed points");
  // Nothing unresolved reached the page.
  await expect(page.locator("#main-content article")).not.toContainText("{{");
});

test("editing a template changes the report it produces", async ({ page }) => {
  await page.goto("/settings/report-templates");
  await page
    .locator("div", { hasText: /^Internal PM/ })
    .getByRole("button", { name: "Edit" })
    .first()
    .click();

  // Rename the first section and switch its automatic content off, leaving
  // only a narrative behind.
  await page.getByRole("textbox", { name: "Section 1 title" }).fill("How It Went");
  await choose(page, "Automatic content for How It Went", "None — prose only");
  await page
    .getByRole("textbox", { name: "Narrative for How It Went" })
    .fill("Closed at {{metrics.completionRate}} of commitment.");
  await page.getByRole("button", { name: "Save Changes" }).click();

  // Client-side to the report builder: the store is in memory, so a reload
  // would throw the edit away.
  const palette = await openPalette(page);
  await palette.fill("OEE");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/modules/oee-intelligence**");
  await page.getByLabel("Section").getByRole("link", { name: "Reports" }).click();
  await page.getByRole("button", { name: /^Internal PM\b/ }).click();
  await page.getByRole("button", { name: "Generate Report" }).click();

  const first = page.locator("#main-content article section").first();
  await expect(first).toContainText("1. How It Went");
  await expect(first).toContainText("Closed at 57% of commitment.");
  // The metric table that used to be welded to this template is gone with it.
  await expect(first).not.toContainText("Blocked Items");
});
