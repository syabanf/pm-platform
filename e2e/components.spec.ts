import { test, expect, openPalette } from "./helpers";

const COMPONENTS =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/components";

/**
 * The one cascade in the app with no undo, and the only one with no coverage.
 *
 * The seed makes it sharp: under OEE Intelligence, "Machine Data Acquisition"
 * owns two sprints and "OEE Dashboard" owns one. A cascade that drops either
 * half of its two-clause filter — `moduleId === mod.id && componentId === id` —
 * takes a sibling's sprints with it and nothing can put them back.
 */
test("deleting a component takes its sprints and their tasks, and leaves siblings alone", async ({
  page,
}) => {
  await page.goto(COMPONENTS);

  const mda = page.getByRole("row", { name: /Machine Data Acquisition/ });
  const dashboard = page.getByRole("row", { name: /OEE Dashboard/ });
  // The Sprints column, before: two for one component, one for the other.
  await expect(mda.getByRole("cell", { name: "2", exact: true })).toBeVisible();
  await expect(dashboard.getByRole("cell", { name: "1", exact: true })).toBeVisible();

  await mda.getByRole("button", { name: "Delete" }).click();
  await mda.getByRole("button", { name: "Confirm?" }).click();
  await expect(page.getByRole("row", { name: /Machine Data Acquisition/ })).toHaveCount(0);

  // Client-side to the Sprints tab: the store is in memory and a reload would
  // put the component straight back.
  await page.getByLabel("Section").getByRole("link", { name: "Sprints" }).click();
  await page.waitForURL("**/oee-intelligence/sprints");

  // Rows, not links: the link reads "Sprint 02" and the sprint's name sits in
  // a sibling div, so it is not part of the link's accessible name.
  //
  // Its two sprints are gone…
  await expect(page.getByRole("row", { name: /Machine Data Validation/ })).toHaveCount(0);
  await expect(page.getByRole("row", { name: /Data Acquisition Setup/ })).toHaveCount(0);
  // …and the sibling's is untouched. This is the assertion that catches a
  // mis-scoped filter, which would silently take this one too.
  await expect(page.getByRole("row", { name: /OEE Dashboard Foundation/ })).toBeVisible();

  // The tasks went with the sprints. ⌘K indexes tasks by title and would still
  // list an orphan whose sprint no longer exists, so this is a real check
  // rather than a restatement of the one above.
  const palette = await openPalette(page);
  await palette.fill("Create API mapping");
  await expect(page.getByRole("option", { name: /Create API mapping/ })).toHaveCount(0);
});

test("a component's status cycles through its three values and back", async ({ page }) => {
  await page.goto(COMPONENTS);
  const row = page.getByRole("row", { name: /Alert & Notification/ });
  const button = row.getByRole("button", { name: /^Change status/ });

  // The cycle is index-based modulo three, so an inserted value would silently
  // shift every component's next state.
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    seen.push((await button.getAttribute("aria-label"))!.replace(/^.*currently /, ""));
    await button.click();
  }
  expect(seen[3]).toBe(seen[0]);
  expect(new Set(seen.slice(0, 3)).size).toBe(3);
});
