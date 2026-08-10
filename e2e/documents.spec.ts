import { test, expect, choose } from "./helpers";

// Every generator names its subject the same way — client, then project, then
// module where the document is module-scoped — and reads the live store.

const CLIENT_AND_PROJECT = ["/documents/mom", "/documents/kickoff"];
const WITH_MODULE = [
  "/documents/status-update",
  "/documents/change-request",
  "/documents/uat-signoff",
];

for (const path of [...CLIENT_AND_PROJECT, ...WITH_MODULE]) {
  test(`${path} picks its subject from dropdowns`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("combobox", { name: "Client" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Project" })).toBeVisible();
    const wantsModule = WITH_MODULE.includes(path);
    await expect(page.getByRole("combobox", { name: "Module" })).toHaveCount(
      wantsModule ? 1 : 0
    );
  });
}

test("choosing a client narrows the projects to that client's", async ({ page }) => {
  await page.goto("/documents/mom");

  await choose(page, "Client", "UBS Gold");
  await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue(
    "Manufacturing Digital Transformation"
  );

  // Switching client re-points the project without any reset step — the stored
  // project id is a preference, and one belonging to another client is ignored.
  await choose(page, "Client", "BNI");
  await expect(
    page.getByRole("combobox", { name: "Project" })
  ).not.toHaveValue("Manufacturing Digital Transformation");
});

test("a client created in the app shows up in the generators", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add Client" }).click();
  await page.getByPlaceholder("e.g. PT Astra Components").fill("PT Sinar Jaya");
  await choose(page, "Industry", "Logistics");
  await page.getByRole("button", { name: "Create Client" }).click();
  await expect(page.getByRole("link", { name: "PT Sinar Jaya" })).toBeVisible();

  // Client-side, because the store is in memory: the generators used to import
  // the seed arrays straight from @/lib/data, so this client was invisible to
  // them however you navigated.
  await page.getByRole("link", { name: "MoM", exact: true }).click();
  await page.waitForURL("**/documents/mom");
  await page.getByRole("combobox", { name: "Client" }).click();
  await expect(
    page.getByRole("option", { name: "PT Sinar Jaya", exact: true })
  ).toBeVisible();
});
