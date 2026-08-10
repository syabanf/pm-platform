import { test, expect } from "./helpers";

const REPORTS =
  "/clients/ubs-gold/projects/ubs-mdt/modules/oee-intelligence/reports";

/**
 * The export is the only artifact that leaves the app, and it goes to a
 * client. `articleToMarkdown` has unit tests against a hand-built fixture, so
 * nothing until now has run it over a real rendered report.
 */
test("Export Markdown downloads what is on screen, with its tokens resolved", async ({
  page,
}) => {
  await page.goto(REPORTS);
  await page.getByRole("button", { name: /^Client Facing\b/ }).click();
  await page.getByRole("button", { name: "Generate Report" }).click();

  const article = page.locator("#main-content article");
  const headings = await article.locator("h3").allInnerTexts();
  expect(headings.length).toBeGreaterThan(0);

  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toMatch(/^oee-intelligence-platform-.*\.md$/);

  const stream = await download.createReadStream();
  const body = await new Promise<string>((resolve, reject) => {
    let text = "";
    stream.on("data", (c) => (text += c));
    stream.on("end", () => resolve(text));
    stream.on("error", reject);
  });

  // Every section that is on screen is in the file.
  for (const heading of headings) {
    expect(body, `missing section: ${heading}`).toContain(
      heading.replace(/^\d+\.\s*/, "")
    );
  }
  // The assertion that matters: an unresolved token shipping to a client is
  // the failure mode this export has, and a fixture test cannot catch it.
  expect(body, "an unresolved {{token}} reached the exported file").not.toContain("{{");
});

test("marking a report sent completes its row in the queue", async ({ page }) => {
  await page.goto(REPORTS);
  await page.getByRole("button", { name: /^Client Facing\b/ }).click();
  await page.getByRole("button", { name: "Generate Report" }).click();

  await page.getByRole("button", { name: "Mark as Sent" }).click();
  await expect(page.getByText(/^Sent on /)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as Sent" })).toHaveCount(0);
});
