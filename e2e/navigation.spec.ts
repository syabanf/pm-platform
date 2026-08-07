import { test, expect, SPRINTS_TAB } from "./helpers";

test("⌘K jumps from anywhere to a module by name", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByPlaceholder(/search/i);
  await expect(palette).toBeVisible();
  await palette.fill("SCADA");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/modules/scada-monitoring**");
});

test("the calendar view opens a day's detail and Escape closes it", async ({ page }) => {
  await page.goto(SPRINTS_TAB);
  await page.getByRole("tab", { name: "Calendar" }).click();

  // Any day that carries work — its number is a button labelled with the count.
  await page
    .getByRole("button", { name: /tasks?$/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Due this day");

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("a blocker category added in Settings appears in the board's form", async ({ page }) => {
  await page.goto("/settings/lists");
  // blockerCategories is the last list on the page, so its add-box is the
  // last "Add value…" input.
  const addBox = page.getByPlaceholder("Add value…").last();
  await addBox.fill("Legal review");
  await addBox.press("Enter");
  await expect(page.getByText("Legal review")).toBeVisible();

  // The board's AddBlocker select reads the same master list — but only for
  // this browsing session, because the store is in memory. Navigate
  // client-side (⌘K), not page.goto(): a full reload resets the store and
  // would wipe the category we just added.
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByPlaceholder(/search/i);
  await palette.fill("OEE");
  await page.keyboard.press("Enter");
  await page.waitForURL("**/modules/oee-intelligence**");
  await page.getByRole("link", { name: "Sprints", exact: true }).click();
  await page.getByRole("link", { name: /Sprint 03/ }).click();
  await page.waitForURL("**/sprints/sprint-03/**");
  const card = page.locator("div.p-3").filter({ hasText: "Draft alert threshold" });
  await card.getByRole("button", { name: "Details" }).click();
  await expect(
    card.getByLabel("Blocker category").locator("option", { hasText: "Legal review" })
  ).toHaveCount(1);
});

test("phone tier shows the bottom bar and the board still works @mobile", async ({ page }) => {
  await page.goto("/");
  // The sidebar also has these links; the phone claim is about the bottom bar.
  const bottomBar = page.getByLabel("Bottom navigation");
  await expect(bottomBar.getByRole("link", { name: "Home" })).toBeVisible();
  await expect(bottomBar.getByRole("link", { name: "Clients" })).toBeVisible();

  const BOARD =
    "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board";
  await page.goto(BOARD);
  // The lanes scroll sideways on a phone; the first card must be reachable
  // and its Details button tappable — no hover anywhere on this path.
  const card = page.locator("div.p-3").filter({ hasText: "Validate telemetry API" });
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("button", { name: "Details" }).click();
  await expect(card.getByText("Definition of Done")).toBeVisible();
});
