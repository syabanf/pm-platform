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
