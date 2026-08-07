import { describe, expect, it } from "vitest";
import { defaultSprintDates, workingDaysBetween } from "./SprintPanel";

/**
 * The sprint form derives its working-day count instead of assuming ten, and
 * the count is what gets stored on the sprint. Getting it wrong quietly
 * misstates capacity on every burndown that reads it.
 */
describe("workingDaysBetween", () => {
  it("counts both ends of a plain working week", () => {
    // Mon 2026-08-03 → Fri 2026-08-07
    expect(workingDaysBetween("2026-08-03", "2026-08-07")).toBe(5);
  });

  it("leaves weekends out", () => {
    // Mon → Sun spans 7 calendar days but only 5 working ones
    expect(workingDaysBetween("2026-08-03", "2026-08-09")).toBe(5);
  });

  it("gives the usual fortnight ten days, not fourteen", () => {
    const { startDate, endDate } = { startDate: "2026-08-07", endDate: "2026-08-20" };
    expect(workingDaysBetween(startDate, endDate)).toBe(10);
  });

  it("counts a single working day as one", () => {
    expect(workingDaysBetween("2026-08-07", "2026-08-07")).toBe(1);
  });

  it("counts a lone weekend day as none", () => {
    expect(workingDaysBetween("2026-08-08", "2026-08-09")).toBe(0);
  });

  it("returns zero when the end falls before the start", () => {
    expect(workingDaysBetween("2026-08-20", "2026-08-07")).toBe(0);
  });

  it("returns zero rather than NaN for an unparseable date", () => {
    expect(workingDaysBetween("", "2026-08-20")).toBe(0);
    expect(workingDaysBetween("not-a-date", "2026-08-20")).toBe(0);
  });
});

describe("defaultSprintDates", () => {
  it("offers a fortnight, as YYYY-MM-DD", () => {
    const { startDate, endDate } = defaultSprintDates();
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const days =
      (new Date(`${endDate}T00:00:00`).getTime() -
        new Date(`${startDate}T00:00:00`).getTime()) /
      86_400_000;
    expect(days).toBe(13);
  });

  it("uses the local date, so a late-evening sprint does not start tomorrow", () => {
    // toISOString() would roll past midnight for anyone east of UTC.
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(defaultSprintDates().startDate).toBe(expected);
  });
});
