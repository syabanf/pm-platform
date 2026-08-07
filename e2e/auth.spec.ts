import { test, expect } from "@playwright/test";

// The one spec that earns its session honestly: no seeded localStorage.

test("a signed-out visitor is walled off to /login", async ({ page }) => {
  await page.goto("/clients");
  await page.waitForURL("**/login");
  await expect(page.getByText("Demo accounts — one click")).toBeVisible();
});

test("one-click demo login lands on Home with the triage list", async ({ page }) => {
  await page.goto("/login");
  // Skip the first-visit wizard before it can cover the screen.
  await page.evaluate(() => window.localStorage.setItem("wit-howto-seen", "1"));
  await page.getByRole("button", { name: /Fahmi/ }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
  await expect(page.getByText("Needs Attention")).toBeVisible();
});

test("email login accepts any non-empty password and maps the address", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => window.localStorage.setItem("wit-howto-seen", "1"));
  await page.getByLabel("Email").fill("someone-new@client.com");
  await page.getByLabel("Password").fill("anything");
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("login"));
  await expect(page.getByText("Needs Attention")).toBeVisible();
});
