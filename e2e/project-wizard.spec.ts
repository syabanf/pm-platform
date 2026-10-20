import { test, expect, choose } from "./helpers";

test("Add Project on a client opens the wizard with that client chosen", async ({ page }) => {
  await page.goto("/clients/bsm");
  await page.getByRole("link", { name: "Add Project" }).click();
  await page.waitForURL("**/projects/new?client=bsm");
  await expect(page.getByRole("combobox", { name: "Client" })).toHaveValue("BSM");
});

test("the wizard creates a project, its modules and their components in one pass", async ({
  page,
}) => {
  await page.goto("/clients/ubs-gold");
  await page.getByRole("link", { name: "Add Project" }).click();
  await page.waitForURL("**/projects/new**");

  const next = page.getByRole("button", { name: "Continue" });
  await next.click();

  // Step 2 will not move on without a name.
  await expect(next).toBeDisabled();
  await page.getByLabel("Project Name").fill("Warehouse Digitalization");
  await page.getByLabel("Start Date").fill("2026-11-02");
  await next.click();

  await expect(next).toBeDisabled();
  await page.getByLabel("Module 1 Name").fill("Inventory Tracking");
  await page.getByLabel("Module 1 Components").fill("Barcode scan, Stock ledger");
  await page.getByRole("button", { name: "Add another module" }).click();
  await page.getByLabel("Module 2 Name").fill("Reorder Alerts");
  await next.click();

  // Review states what is about to be created.
  const review = page.getByRole("main");
  await expect(review).toContainText("UBS Gold");
  await expect(review).toContainText("Warehouse Digitalization");
  await expect(review).toContainText("2 components");

  await page.getByRole("button", { name: "Create Project" }).click();
  await page.waitForURL("**/clients/ubs-gold/projects/project-*");
  await expect(page.getByRole("heading", { name: "Warehouse Digitalization" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Inventory Tracking" })).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: "Reorder Alerts" })).toBeVisible();

  // Components landed on the module, not just in the review text.
  await page.getByRole("main").getByRole("link", { name: "Inventory Tracking" }).click();
  await page.getByLabel("Section").getByRole("link", { name: "Components" }).click();
  await expect(page.getByRole("row", { name: /Barcode scan/ })).toBeVisible();
  await expect(page.getByRole("row", { name: /Stock ledger/ })).toBeVisible();
});

test("the wizard can create the client too", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByRole("radio", { name: "New client" }).click();
  const next = page.getByRole("button", { name: "Continue" });
  await expect(next).toBeDisabled();
  await page.getByLabel("Client Name").fill("PT Sinar Jaya");
  await choose(page, "Industry", "Logistics");
  await next.click();

  await page.getByLabel("Project Name").fill("Fleet Visibility");
  await next.click();
  await page.getByLabel("Module 1 Name").fill("GPS Tracking");
  await next.click();
  await page.getByRole("button", { name: "Create Project" }).click();

  await page.waitForURL("**/projects/project-*");
  // The new client exists and the project files under it.
  await page.getByRole("link", { name: "PT Sinar Jaya" }).first().click();
  await expect(page.getByRole("main").getByRole("link", { name: "Fleet Visibility" })).toBeVisible();
});
