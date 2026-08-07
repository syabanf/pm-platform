import { test, expect, SPRINTS_TAB } from "./helpers";

// The Sprints tab owns sprint CRUD since the panel moved here — these pin the
// whole loop: create with live working-days feedback, edit, delete.

test("creating a sprint from the Sprints tab, dates and all", async ({ page }) => {
  await page.goto(SPRINTS_TAB);
  await page.getByRole("button", { name: "Add Sprint", exact: true }).click();

  await page.getByLabel("Name").fill("Alarm Rules Hardening");
  await page.getByLabel("Component").selectOption({ label: "PLC Connectivity" });

  // The default fortnight counts 10 working days; stretching the end date
  // must move the counter live — this is the feedback that replaced making
  // people count weekends by hand.
  await expect(page.getByText(/10 working days/)).toBeVisible();
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
