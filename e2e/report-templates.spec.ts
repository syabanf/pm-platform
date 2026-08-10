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

test("deleting a template breaks its reports, and Undo puts both back", async ({
  page,
}) => {
  await generate(page, "Internal PM");
  const article = page.locator("#main-content article");
  await expect(article.locator("h3").first()).toContainText("Sprint Health");

  // Client-side to Settings: the store is in memory.
  await page.getByLabel("Primary").getByRole("link", { name: "Settings", exact: true }).click();
  await page.waitForURL("**/settings");
  await page.getByLabel("Section").getByRole("link", { name: "Report Templates" }).click();
  await page.waitForURL("**/settings/report-templates");

  // The card itself, not the grid that holds all six of them.
  const card = page
    .locator("div.group.border-line")
    .filter({ hasText: "Internal PM" })
    .first();
  await card.getByRole("button", { name: "Delete" }).click();
  await card.getByRole("button", { name: "Confirm?" }).click();

  // The toast names the consequence rather than saying "removed".
  const toast = page.getByRole("status");
  await expect(toast).toContainText("Reports generated from it");

  // Undo restores the template — and, the part that matters, restores what the
  // reports made from it render. A fix that put the row back without that
  // would pass a naive test.
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(
    page.locator("#main-content").getByText("Internal PM", { exact: true })
  ).toBeVisible();
});
