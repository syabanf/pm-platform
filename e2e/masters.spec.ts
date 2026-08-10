import { test, expect } from "./helpers";

// Master data is a directory of lists grouped by the feature that uses them,
// with a page per list.

test("the master data index groups every list under its feature", async ({
  page,
}) => {
  await page.goto("/settings/masters");

  for (const feature of ["Clients", "People", "Delivery", "Reports & Documents"]) {
    await expect(page.getByRole("button", { name: new RegExp(feature) })).toBeVisible();
  }

  // And each row opens that list's own page.
  await page.getByRole("link", { name: "Industries" }).click();
  await page.waitForURL("**/settings/masters/industries");
  await expect(page.getByText("Manufacturing")).toBeVisible();
});

test("the old /settings/lists link still lands somewhere useful", async ({ page }) => {
  await page.goto("/settings/lists");
  await page.waitForURL("**/settings/masters");
  await expect(page.getByRole("button", { name: /Clients/ })).toBeVisible();
});

test("a renamed job role follows through to the records using it", async ({
  page,
}) => {
  await page.goto("/settings/masters/jobRoles");
  await page.getByRole("button", { name: "Edit" }).first().click();
  const field = page.getByRole("textbox", { name: /^Rename / });
  await field.fill("Delivery Principal");
  await field.press("Enter");
  // Scoped to the page: the signed-in user in the sidebar carries this role
  // too, which is itself the propagation this test is about.
  const main = page.locator("#main-content");
  await expect(main.getByText("Delivery Principal")).toBeVisible();

  // Via the settings tab, not page.goto: the store is in memory, so a full
  // reload would throw away the rename this test just made.
  await page.getByLabel("Section").getByRole("link", { name: "Members" }).click();
  await page.waitForURL("**/settings/members");
  // The member who held the old label now shows the new one — a rename is a
  // rewrite of every referencing record, not just a relabel of the list.
  await expect(main.getByText("Delivery Principal").first()).toBeVisible();
});

test("a role with nobody assigned still appears in the member filter", async ({
  page,
}) => {
  await page.goto("/settings/masters/jobRoles");
  const addBox = page.getByPlaceholder("Add value…");
  await addBox.fill("Solution Architect");
  await addBox.press("Enter");

  await page.getByLabel("Section").getByRole("link", { name: "Members" }).click();
  await page.waitForURL("**/settings/members");

  // The filter reads the master, not the roles that happen to be in use.
  await expect(
    page.getByRole("button", { name: "Solution Architect", exact: true })
  ).toBeVisible();
});

test("renaming a value onto one that already exists is refused", async ({ page }) => {
  await page.goto("/settings/masters/industries");
  const rows = page.locator("#main-content li");
  // Count only once the list has actually rendered — reading it straight after
  // goto() captured zero and made the assertion below pass for the wrong reason.
  await expect(rows.first()).toBeVisible();
  const before = await rows.count();

  // "Banking" is the second row; rename it onto the first.
  await page.getByRole("button", { name: "Edit" }).nth(1).click();
  const field = page.getByRole("textbox", { name: /^Rename / });
  await field.fill("Manufacturing");
  await field.press("Enter");

  // Two identical rows would behave as one: the editor keys on the value, so
  // Edit and Delete would both act on the pair.
  await expect(
    page.locator("#main-content").getByText("Manufacturing", { exact: true })
  ).toHaveCount(1);
  await expect(rows).toHaveCount(before);
  await expect(
    page.locator("#main-content").getByText("Banking", { exact: true })
  ).toHaveCount(1);
});
