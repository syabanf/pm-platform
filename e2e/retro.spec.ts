import { test, expect } from "./helpers";

// The retro used to be one frozen object rendered as a working board. These
// four tests are the four things that were wrong with that.

const RETRO_03 =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/retro";
const REVIEW_03 =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/review";

/** Ceremony tabs, so the in-memory store survives the trip. */
const ceremony = (page: import("@playwright/test").Page, name: string) =>
  page.getByLabel("Section").getByRole("link", { name, exact: true }).click();

test("a retro note survives leaving the page and coming back", async ({ page }) => {
  await page.goto(RETRO_03);

  const box = page.getByRole("textbox", { name: "Add to Went Well" });
  await box.fill("Pairing on the ingestion bug paid off");
  await box.press("Enter");
  await expect(page.getByText("Pairing on the ingestion bug paid off")).toBeVisible();

  // Client-side: a reload would reset the store and prove nothing.
  await ceremony(page, "Board");
  await page.waitForURL("**/sprint-03/board");
  await ceremony(page, "Retro");
  await page.waitForURL("**/sprint-03/retro");

  await expect(page.getByText("Pairing on the ingestion bug paid off")).toBeVisible();
});

test("an overdue action opens its own sprint's retro, and closing it clears Home", async ({
  page,
}) => {
  await page.goto("/");
  const main = page.getByRole("main");
  // This action belongs to scada-s1, not Sprint 03 — which is the point. The
  // href used to be hardcoded to oee-intelligence/sprint-03/retro, so every
  // overdue action, whichever sprint it came from, sent you to the same one.
  const overdue = "Book PLC test windows with the plant a sprint ahead";
  await expect(main.getByText(overdue)).toBeVisible();

  await main.getByText(overdue).click();
  await page.waitForURL("**/scada-monitoring/sprints/scada-s1/retro");

  const row = page.getByRole("listitem").filter({ hasText: overdue });
  await row.getByRole("button", { name: "Close" }).click();
  await expect(row.getByText("done", { exact: true })).toBeVisible();

  // Client-side back to Home: a reload would reset the store.
  await page.getByLabel("Primary").getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForURL(/\/$/);

  // Gone from Needs Attention, because it is genuinely closed now — before
  // this change there was no way to close it at all.
  await expect(page.getByRole("main").getByText(overdue)).toHaveCount(0);
});

test("two sprints show two different retros", async ({ page }) => {
  await page.goto(RETRO_03);
  await expect(
    page.getByText("QA scenarios were ready before development finished")
  ).toBeVisible();

  // Sprint 01's retro, reached client-side through the module's Sprints tab.
  await page.getByLabel("Section").getByRole("link", { name: "Sprints" }).click();
  await page.waitForURL("**/oee-intelligence/sprints");
  await page.getByRole("link", { name: /Sprint 01/ }).click();
  await page.waitForURL("**/sprint-01/**");
  await ceremony(page, "Retro");
  await page.waitForURL("**/sprint-01/retro");

  await expect(
    page.getByText("Discovery workshops produced a clear pilot scope")
  ).toBeVisible();
  // The bug that started this: every sprint rendered Sprint 03's retro.
  await expect(
    page.getByText("QA scenarios were ready before development finished")
  ).toHaveCount(0);
});

test("a ticked demo item stays ticked", async ({ page }) => {
  await page.goto(REVIEW_03);

  const item = page
    .getByRole("checkbox")
    .and(page.locator('input[type="checkbox"]'))
    .last();
  await expect(item).not.toBeChecked();
  await item.check();

  await ceremony(page, "Board");
  await page.waitForURL("**/sprint-03/board");
  await ceremony(page, "Review");
  await page.waitForURL("**/sprint-03/review");

  await expect(
    page.getByRole("checkbox").and(page.locator('input[type="checkbox"]')).last()
  ).toBeChecked();
});

test("an action cannot be saved without a due date", async ({ page }) => {
  await page.goto(RETRO_03);

  await page.getByRole("textbox", { name: "New retro action" }).fill("Pilot the handover checklist");
  await page.getByLabel("Action due date").fill("");
  await page.getByRole("button", { name: "Add Action" }).click();

  // An emptied date input reports "", and "" sorts before every real date — so
  // this used to save and land on Home as overdue the moment it was created.
  await expect(page.getByRole("status")).toContainText("due date");
  await expect(
    page.getByRole("listitem").filter({ hasText: "Pilot the handover checklist" })
  ).toHaveCount(0);
});

test("a retro note's delete control is visible, not just hoverable", async ({ page }) => {
  await page.goto(RETRO_03);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "QA scenarios were ready before development finished" });

  // The reveal compiles inside @media (hover: hover), so an opacity-0 wrapper
  // stays invisible forever on a touch device while remaining tappable.
  const opacity = await row
    .getByRole("button", { name: "Delete" })
    .evaluate((el) => getComputedStyle(el.parentElement!).opacity);
  expect(Number(opacity)).toBeGreaterThan(0);
});
