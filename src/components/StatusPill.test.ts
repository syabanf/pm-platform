import { describe, expect, it } from "vitest";
import { statusTitles, statusTones } from "./StatusPill";
import { BOARD_COLUMNS } from "@/lib/boardColumns";
import type {
  BoardColumn,
  Client,
  Component,
  Decision,
  Member,
  Module,
  Project,
  Readiness,
  Sprint,
} from "@/lib/types";

/**
 * Every status value the app can hand to StatusPill.
 *
 * `Exhaustive` below is what makes this list trustworthy: it is a compile
 * error to add a member to one of these unions without listing it here, and a
 * test failure to list it without giving it a tone. Four values — "on-hold"
 * and three board columns — were rendering as plain grey with no tooltip
 * because nothing connected the two.
 */
const RENDERED = {
  "Client.health": ["healthy", "warning", "at-risk"],
  "Client.risk": ["low", "medium", "high"],
  "Client.status": ["active", "inactive", "prospect"],
  "Project.status": ["discovery", "active", "done", "on-hold"],
  "Module.status": ["discovery", "development", "release", "maintenance"],
  "Component.status": ["planned", "in-progress", "done"],
  "Sprint.status": ["planning", "active", "review", "done"],
  "BacklogItem.readiness": ["ready", "needs-clarification", "draft"],
  "Decision.status": ["open", "decided"],
  "Member.status": ["active", "inactive", "temporary"],
  "Task.column": BOARD_COLUMNS.map((c) => c.id),
  // Not union members — computed states some call sites pass directly.
  computed: ["overloaded", "blocked", "planned"],
} satisfies Record<string, string[]>;

/** A compile error here means a union grew and RENDERED did not. */
type Exhaustive =
  | Exclude<Client["health"], (typeof RENDERED)["Client.health"][number]>
  | Exclude<Client["risk"], (typeof RENDERED)["Client.risk"][number]>
  | Exclude<Client["status"], (typeof RENDERED)["Client.status"][number]>
  | Exclude<Project["status"], (typeof RENDERED)["Project.status"][number]>
  | Exclude<Module["status"], (typeof RENDERED)["Module.status"][number]>
  | Exclude<Component["status"], (typeof RENDERED)["Component.status"][number]>
  | Exclude<Sprint["status"], (typeof RENDERED)["Sprint.status"][number]>
  | Exclude<Readiness, (typeof RENDERED)["BacklogItem.readiness"][number]>
  | Exclude<Decision["status"], (typeof RENDERED)["Decision.status"][number]>
  | Exclude<Member["status"], (typeof RENDERED)["Member.status"][number]>
  | Exclude<BoardColumn, (typeof RENDERED)["Task.column"][number]>;

const _exhaustive: Exhaustive extends never ? true : never = true;
void _exhaustive;

describe("StatusPill", () => {
  const all = [...new Set(Object.values(RENDERED).flat())].sort();

  it("gives every status a colour", () => {
    const missing = all.filter((s) => !(s in statusTones));
    expect(missing, "statuses falling through to plain grey").toEqual([]);
  });

  it("gives every status a plain-language tooltip", () => {
    // The pill is a coloured abbreviation; the title is the only place its
    // meaning is written down.
    const missing = all.filter((s) => !(s in statusTitles));
    expect(missing, "statuses with no hover explanation").toEqual([]);
  });

  it("explains everything it colours", () => {
    const coloured = Object.keys(statusTones);
    expect(coloured.filter((s) => !(s in statusTitles))).toEqual([]);
  });
});
