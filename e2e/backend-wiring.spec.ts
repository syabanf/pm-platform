import { test, expect } from "./helpers";

/**
 * The wiring vertical, guarded end to end: sign in against the real backend
 * through the proxy and list real clients. It needs a backend on the other end
 * of next.config's proxy, so it skips politely when there is none — the same
 * courtesy the Go e2e suite extends when Postgres is absent.
 */
test("the backend probe signs in and lists live clients", async ({ page }) => {
  // Is a backend reachable through the proxy? If not, this machine can't run it.
  const health = await page.request.get("/api/healthz").catch(() => null);
  test.skip(!health || !health.ok(), "no backend behind the proxy");

  // And is it *this* tree's backend? /healthz answers on every version ever
  // built, so a stale binary left running from before routes moved under
  // /api/v1 passes the check above and then fails here with a message about
  // sign-in, which is not what went wrong. A 404 on the versioned surface
  // means the process is older than this checkout; say so and skip.
  const versioned = await page.request
    .post("/api/v1/auth/login", { data: {}, failOnStatusCode: false })
    .catch(() => null);
  test.skip(
    !versioned || versioned.status() === 404,
    "backend is reachable but does not serve /api/v1 — stale process, restart it"
  );

  await page.goto("/backend");
  await page.getByRole("button", { name: "Sign in to backend" }).click();
  await expect(page.getByText(/signed in as .+@.+/)).toBeVisible();

  await page.getByRole("button", { name: "Load clients" }).click();
  // The list header states the count, and rows render from the database.
  await expect(page.getByText(/\d+ clients — live from the database/)).toBeVisible();
  await expect(page.locator("ul li").first()).toBeVisible();
});
