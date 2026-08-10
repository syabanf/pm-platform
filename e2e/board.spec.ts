import { test, expect, choose, BOARD } from "./helpers";

// The board is where the "task simplify" work landed: a Details button that
// says what it opens, a column select that replaced drag-only movement, and
// blockers that are visible without opening anything.

test("adding a task puts a card in the lane", async ({ page }) => {
  await page.goto(BOARD);
  await page.getByRole("button", { name: "+ Add task" }).first().click();
  await page.getByPlaceholder(/task title/i).fill("Wire the histogram panel");
  await page.getByRole("button", { name: /^Add$/ }).click();
  await expect(page.getByText("Wire the histogram panel")).toBeVisible();
});

test("Details opens the card's controls; a keyboard user can move it", async ({ page }) => {
  await page.goto(BOARD);
  const card = page.locator("div.p-3").filter({ hasText: "Create API mapping" });

  await card.getByRole("button", { name: "Details" }).click();
  // Scoped to the card: the sidebar also says "Definition of Done".
  await expect(card.getByText("Definition of Done")).toBeVisible();

  // Moving by select is the drag path's equal — same moveTask, same gates.
  await choose(page, "Move task to column", "In Review");
  // The proof is the destination: the In Review column now holds the card.
  const inReview = page
    .locator("div.border-t-2")
    .filter({ has: page.locator('span.label:text-is("In Review")') });
  await expect(inReview.getByText("Create API mapping")).toBeVisible();
});

test("ticking a DoD item moves the count", async ({ page }) => {
  await page.goto(BOARD);
  const card = page.locator("div.p-3").filter({ hasText: "Draft alert threshold" });
  await expect(card.getByText("DoD 0/2")).toBeVisible();
  await card.getByRole("button", { name: "Details" }).click();
  await card.getByRole("checkbox").first().check();
  await expect(card.getByText("DoD 1/2")).toBeVisible();
});

test("blockers darken the card as they stack, and clear from the list @blockers", async ({
  page,
}) => {
  await page.goto(BOARD);
  const card = page.locator("div.p-3").filter({ hasText: "Create API mapping" });

  // Seeded with three blockers: solid red, count visible without opening.
  await expect(card.getByText("3 blockers")).toBeVisible();
  await expect(card).toHaveClass(/bg-danger\/10/);

  // Clearing one steps the card down a shade — severity is one function, so
  // the colour and the count cannot disagree.
  await card.getByRole("button", { name: "Details" }).click();
  await card.getByRole("button", { name: /^Clear blocker/ }).first().click();
  await expect(card.getByText("2 blockers")).toBeVisible();
  await expect(card).toHaveClass(/bg-danger\/5/);

  // And adding one puts it back.
  await choose(card, "Blocker category", "Resourcing");
  await card.getByPlaceholder(/what is it waiting on/i).fill("No QA free until next sprint");
  await card.getByRole("button", { name: /^Add$/ }).click();
  await expect(card.getByText("3 blockers")).toBeVisible();
});

test("the Definition of Done gate refuses Done, then lets it through @dod", async ({
  page,
}) => {
  await page.goto(BOARD);
  const card = page.locator("div.p-3").filter({ hasText: "Draft alert threshold config screen" });
  await card.getByRole("button", { name: "Details" }).click();

  const column = card.getByRole("combobox", { name: "Move task to column" });
  await choose(page, "Move task to column", "Done");

  // Refused, and it says why. Scoped by aria-live: the board also renders
  // dnd-kit's assertive live region, so a bare getByRole("status") is
  // ambiguous on this page and on no other.
  const toast = page.locator('[role="status"][aria-live="polite"]');
  await expect(toast).toContainText("Definition of Done");
  // The field snaps back, because it is controlled by task.column and the
  // store never changed. A locally-stateful control would leave the UI
  // claiming the card had moved while the board disagreed.
  await expect(column).toHaveValue("Selected");
  const selected = page
    .locator("div.border-t-2")
    .filter({ has: page.locator('span.label:text-is("Selected")') });
  await expect(selected.getByText("Draft alert threshold config screen")).toBeVisible();

  // Tick both boxes and the same move goes through.
  for (const box of await card.locator('input[type="checkbox"]').all()) await box.check();
  await expect(card.getByText("DoD 2/2")).toBeVisible();
  await choose(page, "Move task to column", "Done");

  const done = page
    .locator("div.border-t-2")
    .filter({ has: page.locator('span.label:text-is("Done")') });
  await expect(done.getByText("Draft alert threshold config screen")).toBeVisible();
});

test("blocking a task moves it out of its column and onto Home @blockers", async ({
  page,
}) => {
  await page.goto(BOARD);
  // A Selected task, not a already-blocked one. board.spec's other blocker
  // test uses a card seeded as blocked, so the auto-move branch never runs
  // there — two tests that look like they cover this and neither does.
  const card = page.locator("div.p-3").filter({ hasText: "Draft alert threshold config screen" });
  await card.getByRole("button", { name: "Details" }).click();

  await choose(card, "Blocker category", "Resourcing");
  await card.getByPlaceholder(/what is it waiting on/i).fill("Waiting on the alerting spec");
  await card.getByRole("button", { name: /^Add$/ }).click();

  const blocked = page
    .locator("div.border-t-2")
    .filter({ has: page.locator('span.label:text-is("Blocked")') });
  await expect(blocked.getByText("Draft alert threshold config screen")).toBeVisible();

  // And the consequence a PM actually sees: Home's triage reads the same
  // blocked tasks, so this is what makes the auto-move worth having.
  await page.getByLabel("Primary").getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForURL(/\/$/);
  await expect(
    page.getByRole("main").getByText("Draft alert threshold config screen")
  ).toBeVisible();
});
