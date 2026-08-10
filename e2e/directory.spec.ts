import { test, expect } from "./helpers";

// Clients are a directory now, not one flat table that grows past reading.

test("clients are grouped into collapsible industry folders", async ({ page }) => {
  await page.goto("/clients");

  // A folder per industry, alphabetical, each carrying its count.
  const folders = page.getByRole("main").getByRole("button", { expanded: true });
  await expect(folders.filter({ hasText: "Banking" })).toBeVisible();
  await expect(folders.filter({ hasText: "Manufacturing" })).toBeVisible();

  // The rows live inside, reachable.
  await expect(page.getByRole("link", { name: "BNI" })).toBeVisible();

  // Folding closes the group for real: collapsed to nothing, and inert, so its
  // rows leave the tab order and the accessibility tree rather than lurking
  // invisibly inside a shut folder. (Playwright still calls a clipped element
  // "visible" — it only measures the box — so assert what actually changed.)
  const banking = page.getByRole("main").getByRole("button", { name: /Banking/ });
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

// The sidebar is a directory too: it shows the branch you are standing in.
// Bounded by construction — nothing expands, so nothing accumulates.

const DEEP =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board";

test("the sidebar shows the branch you are standing in", async ({ page }) => {
  await page.goto(DEEP);
  const sidebar = page.getByLabel("Primary");

  // The spine, whatever the depth below it.
  await expect(sidebar.getByRole("link", { name: "UBS Gold" })).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "Manufacturing Digital Transformation" })
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "OEE Intelligence Platform" })
  ).toBeVisible();

  // Ancestor and current are different states, not the same bold: standing on
  // a sprint route, the module is where you are and the client is not.
  await expect(
    sidebar.getByRole("link", { name: "OEE Intelligence Platform" })
  ).toHaveAttribute("aria-current", "true");
  await expect(
    sidebar.getByRole("link", { name: "UBS Gold" })
  ).not.toHaveAttribute("aria-current", /.*/);

  // One client, never a list of them.
  await expect(sidebar.getByRole("link", { name: "BSM", exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("link", { name: "BNI", exact: true })).toHaveCount(0);
});

test("a sibling module is one click sideways", async ({ page }) => {
  await page.goto(DEEP);
  await page
    .getByLabel("Primary")
    .getByRole("link", { name: "SCADA Monitoring" })
    .click();
  await page.waitForURL("**/modules/scada-monitoring");
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "SCADA Monitoring" })
  ).toHaveAttribute("aria-current", "page");
});

test("the branch is gone off the client routes", async ({ page }) => {
  await page.goto(DEEP);
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "UBS Gold" })
  ).toBeVisible();
  await page.goto("/");
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "UBS Gold" })
  ).toHaveCount(0);
});

test("stepping up to the client swaps modules for projects", async ({ page }) => {
  await page.goto(DEEP);
  await page.getByLabel("Primary").getByRole("link", { name: "UBS Gold" }).click();
  await page.waitForURL("**/clients/ubs-gold");
  const sidebar = page.getByLabel("Primary");
  await expect(sidebar.getByRole("link", { name: "UBS Gold" })).toHaveAttribute(
    "aria-current",
    "page"
  );
  await expect(
    sidebar.getByRole("link", { name: "Manufacturing Digital Transformation" })
  ).toBeVisible();
  await expect(
    sidebar.getByRole("link", { name: "OEE Intelligence Platform" })
  ).toHaveCount(0);
});

test("the active nav item stays in view on a deep route", async ({ page }) => {
  // The branch used to scroll its current row into view, which pushed the
  // "Clients" nav item — the one carrying the active state for the whole
  // section — off the top of the scrollable nav. The state was correct and
  // invisible, which reads as no active menu at all.
  await page.goto(
    "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board"
  );
  const sidebar = page.getByLabel("Primary");
  await expect(sidebar.getByRole("link", { name: "OEE Intelligence Platform" })).toBeVisible();

  const seen = await sidebar.evaluate((nav) => {
    const box = nav.getBoundingClientRect();
    const inside = (el: Element) => {
      const b = el.getBoundingClientRect();
      return b.top >= box.top - 1 && b.bottom <= box.bottom + 1;
    };
    const parent = [...nav.querySelectorAll(":scope > div > a")].find((a) =>
      a.getAttribute("aria-current")
    );
    const deepest = [...nav.querySelectorAll("a[aria-current]")].pop();
    return {
      parent: parent?.textContent?.trim() ?? null,
      parentVisible: parent ? inside(parent) : false,
      deepestVisible: deepest ? inside(deepest) : false,
    };
  });

  expect(seen.parent).toBe("Clients");
  expect(seen.parentVisible, "the active section is scrolled out of sight").toBe(true);
  expect(seen.deepestVisible, "the row you are standing on is out of sight").toBe(true);
});
