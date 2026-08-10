import type { BoardColumn } from "./types";

/**
 * The board's columns, in order, and the groups the rest of the app reads them
 * in.
 *
 * This vocabulary was written out in four files — the board itself, the
 * workload view, the report data, and the calendar's dot colours — and the
 * to-do / in-flight split was byte-identical in two of them. A column added to
 * the union would have compiled everywhere and quietly gone missing from three
 * of the four.
 */
export const BOARD_COLUMNS: { id: BoardColumn; label: string }[] = [
  { id: "selected", label: "Selected" },
  { id: "ready", label: "Ready" },
  { id: "in-progress", label: "In Progress" },
  { id: "in-review", label: "In Review" },
  { id: "qa", label: "QA" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

/** Committed but not started — and blocked, which is work that has stalled. */
export const TODO_COLUMNS: BoardColumn[] = ["selected", "ready", "blocked"];

/** Being worked on right now, wherever in the pipeline. */
export const IN_FLIGHT_COLUMNS: BoardColumn[] = ["in-progress", "in-review", "qa"];

export const isInFlight = (column: BoardColumn) =>
  IN_FLIGHT_COLUMNS.includes(column);

export const columnLabel = (column: BoardColumn) =>
  BOARD_COLUMNS.find((c) => c.id === column)?.label ?? column;
