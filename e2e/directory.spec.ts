import { test, expect } from "./helpers";

// Clients are a directory now, not one flat table that grows past reading.

test("clients are grouped into collapsible industry folders", async ({ page }) => {
  await page.goto("/clients");

  // A folder per industry, alphabetical, each carrying its count.
  const folders = page.getByRole("button", { expanded: true });
  await expect(folders.filter({ hasText: "Banking" })).toBeVisible();
  await expect(folders.filter({ hasText: "Manufacturing" })).toBeVisible();

  // The rows live inside, reachable.
  await expect(page.getByRole("link", { name: "BNI" })).toBeVisible();

  // Folding closes the group for real: collapsed to nothing, and inert, so its
  // rows leave the tab order and the accessibility tree rather than lurking
  // invisibly inside a shut folder. (Playwright still calls a clipped element
  // "visible" — it only measures the box — so assert what actually changed.)
  const banking = page.getByRole("button", { name: /Banking/ });
  const regionId = await banking.getAttribute("aria-controls");
  await banking.click();
  await expect(banking).toHaveAttribute("aria-expanded", "false");

  const region = page.locator(`#${regionId}`);
  await expect(region).toHaveAttribute("inert", "");
  await expect
    .poll(async () => (await region.boundingBox())?.height ?? 0)
    .toBe(0);
});

test("the sidebar no longer lists every client", async ({ page }) => {
  await page.goto("/");
  const sidebar = page.getByLabel("Primary");
  // One Clients entry that goes to the directory…
  await expect(sidebar.getByRole("link", { name: "Clients", exact: true })).toBeVisible();
  // …and no per-client children, which is what grew without bound.
  await expect(sidebar.getByRole("link", { name: "BNI", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "UBS Gold", exact: true })).toHaveCount(0);
});
