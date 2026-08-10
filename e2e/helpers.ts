import { test as base, expect, type Locator, type Page } from "@playwright/test";

/**
 * Signed-in test. The prototype's session is a member id in localStorage, so
 * seeding it before the first script runs is a real login as far as the app
 * can tell — AppFrame reads the same key. The how-to wizard's seen-flag rides
 * along so a first-visit overlay never eats a click meant for the test.
 *
 * One spec (auth.spec.ts) deliberately does NOT use this and walks the login
 * screen for real.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, run) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("wit-auth-user", "fahmi");
      window.localStorage.setItem("wit-howto-seen", "1");
    });
    await run(page);
  },
});

export { expect };

/**
 * Open the ⌘K palette robustly. The shortcut listener is attached in an effect,
 * so a press fired before the page is interactive is silently missed — a race
 * that flakes any test pressing ⌘K straight after navigation. This presses,
 * waits briefly, and presses again if the palette has not appeared.
 */
export async function openPalette(page: Page) {
  const input = page.getByPlaceholder(/search/i);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press("ControlOrMeta+k");
    try {
      await expect(input).toBeVisible({ timeout: 1500 });
      return input;
    } catch {
      /* listener not attached yet — press again */
    }
  }
  await expect(input).toBeVisible();
  return input;
}

/**
 * Pick a value from one of the app's dropdowns.
 *
 * They are comboboxes, not `<select>` elements, so `selectOption` does not
 * apply: open the field, then click the option by its visible text. `scope` is
 * a page or any locator, because several of these live inside a task card that
 * the assertions are already scoped to.
 */
export async function choose(
  scope: Page | Locator,
  field: string | RegExp,
  option: string | RegExp
) {
  await scope.getByRole("combobox", { name: field }).click();
  // The option list is portalled to the body so it is never clipped by a
  // scroll container, which also means it is never inside `scope`.
  const page = "page" in scope ? scope.page() : scope;
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The seeded board every deep-link test drives. */
export const BOARD =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board";

/** The seeded module whose Sprints tab has two sprints. */
export const SPRINTS_TAB =
  "/clients/ubs-gold/projects/ubs-mdt/modules/scada-monitoring/sprints";
