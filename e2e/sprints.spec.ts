import { test, expect, choose, SPRINTS_TAB } from "./helpers";

// The Sprints tab owns sprint CRUD since the panel moved here — these pin the
// whole loop: create with live working-days feedback, edit, delete.

test("creating a sprint from the Sprints tab, dates and all", async ({ page }) => {
  await page.goto(SPRINTS_TAB);
  await page.getByRole("button", { name: "Add Sprint", exact: true }).click();

  await page.getByLabel("Name").fill("Alarm Rules Hardening");
  await choose(page, "Component", "PLC Connectivity");

  // The form opens on a fortnight from today, which is always 10 working days.
  await expect(page.getByText(/10 working days/)).toBeVisible();

  // Then pin BOTH ends before asserting a count. Setting only the end date
  // leaves the start at "today", so the expected number would drift with the
  // calendar — this test passed on a Friday and failed the next Monday.
  // 2026-08-07 (Fri) → 2026-09-04 (Fri) is 21 working days on any day it runs.
  await page.getByLabel("Starts").fill("2026-08-07");
  await page.getByLabel("Ends").fill("2026-09-04");
  await expect(page.getByText(/21 working days/)).toBeVisible();

  await page.getByRole("button", { name: "Add sprint", exact: true }).click();

  const row = page.getByRole("row", { name: /Alarm Rules Hardening/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText("PLC Connectivity");
  await expect(row).toContainText("2026-09-04");
});

test("a sprint refuses to save without a name, with words not a shrug", async ({ page }) => {
  await page.goto(SPRINTS_TAB);
  await page.getByRole("button", { name: "Add Sprint", exact: true }).click();
  await page.getByRole("button", { name: "Add sprint", exact: true }).click();
  // p[role=alert]: Next's route announcer is a second, empty alert.
  await expect(page.locator('p[role="alert"]')).toContainText(/name/i);
});

test("editing a sprint from its row", async ({ page }) => {
  await page.goto(SPRINTS_TAB);
  await page
    .getByRole("row", { name: /Realtime Plant View/ })
    .getByRole("button", { name: "Edit" })
    .click();
  await page.getByLabel("Name").fill("Realtime Plant View v2");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("row", { name: /Realtime Plant View v2/ })).toBeVisible();
});

test("deleting a sprint asks twice, then means it", async ({ page }) => {
  await page.goto(SPRINTS_TAB);
  const row = page.getByRole("row", { name: /PLC Connectivity Spike/ });
  await row.getByRole("button", { name: "Delete" }).click();
  // First click arms; the same button now reads Confirm?.
  await row.getByRole("button", { name: "Confirm?" }).click();
  await expect(page.getByRole("row", { name: /PLC Connectivity Spike/ })).toHaveCount(0);
});
