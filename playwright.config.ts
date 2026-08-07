import { defineConfig, devices } from "@playwright/test";

/**
 * Browser e2e for the frontend prototype.
 *
 * The app runs entirely on its in-memory store, which makes these tests
 * hermetic for free: every fresh page load is the pristine seed, so there is
 * no fixture setup, no teardown, and no way for one test to leak into another.
 *
 * In CI the server is the production build — `next build && next start` —
 * because that is what ships; HMR-mode quirks are not worth catching. Locally
 * a dev server already running on 3900 is reused, so `npx playwright test`
 * works mid-development without a rebuild.
 */
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3900",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, grepInvert: /@mobile/ },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }, // chromium-based: one browser download serves both projects
      // The phone pass is a smoke of the layout tier, not a second full run.
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: process.env.CI
      ? "npm run build && npx next start --port 3900"
      : "npx next dev --port 3900",
    url: "http://localhost:3900",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
