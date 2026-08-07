import { test, expect, BOARD } from "./helpers";

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
  await page.getByLabel("Move task to column").selectOption("in-review");
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
  await card.getByLabel("Blocker category").selectOption("Resourcing");
  await card.getByPlaceholder(/what is it waiting on/i).fill("No QA free until next sprint");
  await card.getByRole("button", { name: /^Add$/ }).click();
  await expect(card.getByText("3 blockers")).toBeVisible();
});
