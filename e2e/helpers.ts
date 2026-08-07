import { test as base, type Page } from "@playwright/test";

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

export { expect } from "@playwright/test";

/** The seeded board every deep-link test drives. */
export const BOARD =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/sprints/sprint-03/board";

/** The seeded module whose Sprints tab has two sprints. */
export const SPRINTS_TAB =
  "/clients/ubs-gold/projects/ubs-mdt/modules/scada-monitoring/sprints";
