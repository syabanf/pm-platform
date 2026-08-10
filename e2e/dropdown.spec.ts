import { test, expect } from "./helpers";

// Every dropdown in the app is a searchable combobox. These pin the three
// behaviours that make it worth replacing a native <select>.

test("a dropdown filters by substring, not just by prefix", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add Client" }).click();

  const industry = page.getByRole("combobox", { name: "Industry" });
  await industry.click();
  await expect(page.getByRole("option", { name: "Manufacturing" })).toBeVisible();

  // "equip" is in the middle of "Heavy Equipment Rental" — a native select's
  // typeahead only matches from the start of a label and would find nothing.
  await industry.fill("equip");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toHaveText("Heavy Equipment Rental");

  await industry.press("Enter");
  await expect(industry).toHaveValue("Heavy Equipment Rental");
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("typing replaces the current selection instead of appending to it", async ({
  page,
}) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add Client" }).click();

  const industry = page.getByRole("combobox", { name: "Industry" });
  await industry.click();
  await page.getByRole("option", { name: "Banking", exact: true }).click();
  await expect(industry).toHaveValue("Banking");

  // Refocusing selects the text, so the next keystroke starts a fresh search
  // rather than filtering for "Bankingretail".
  await industry.click();
  await page.keyboard.type("retail");
  await expect(page.getByRole("option", { name: "Retail" })).toBeVisible();
});

test("Escape cancels without changing the value", async ({ page }) => {
  await page.goto("/clients");
  await page.getByRole("button", { name: "Add Client" }).click();

  const industry = page.getByRole("combobox", { name: "Industry" });
  await industry.click();
  await page.getByRole("option", { name: "Banking", exact: true }).click();

  await industry.click();
  await page.keyboard.type("manu");
  await industry.press("Escape");

  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(industry).toHaveValue("Banking");
});

test("the option list is not clipped by the board's scroller", async ({ page }) => {
  await page.goto(
    "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board"
  );
  const card = page.locator("div.p-3").filter({ hasText: "Create API mapping" });
  await card.getByRole("button", { name: "Details" }).click();
  await card.getByRole("combobox", { name: "Move task to column" }).click();

  // Portalled to the body, so the board's overflow container cannot clip it…
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  const box = await list.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  // …and it stays inside the window, flipping above the field if it must.
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
});
