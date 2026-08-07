import { test, expect } from "./helpers";

// Deleting a client removes its whole subtree in one click. Undo is the safety
// net the survey asked for: the toast carries an action that puts it all back.

test("deleting a client can be undone from the toast", async ({ page }) => {
  await page.goto("/clients");

  const row = page.getByRole("row", { name: /UBS Gold/ });
  await expect(row).toBeVisible();

  // ConfirmButton arms on the first click, deletes on the second.
  await row.getByRole("button", { name: "Delete" }).click();
  await row.getByRole("button", { name: "Confirm?" }).click();

  // Gone, and the toast offers a way back.
  await expect(page.getByRole("row", { name: /UBS Gold/ })).toHaveCount(0);
  const toast = page.getByRole("status");
  await expect(toast).toContainText(/UBS Gold.*removed/);

  await toast.getByRole("button", { name: "Undo" }).click();

  // The client — and, by extension, its subtree — is back.
  await expect(page.getByRole("row", { name: /UBS Gold/ })).toBeVisible();
});

test("undo restores the client's projects too, not just the row", async ({ page }) => {
  // Prove the cascade snapshot is whole: delete UBS Gold, undo, then open it
  // and confirm a project that lived under it is present again.
  await page.goto("/clients");
  const row = page.getByRole("row", { name: /UBS Gold/ });
  await row.getByRole("button", { name: "Delete" }).click();
  await row.getByRole("button", { name: "Confirm?" }).click();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();

  await page.getByRole("row", { name: /UBS Gold/ }).getByRole("link").first().click();
  await page.waitForURL("**/clients/ubs-gold");
  // The project list under the client rendered — the subtree survived the round trip.
  await expect(
    page.getByText(/Manufacturing Digital Transformation/)
  ).toBeVisible();
});
