import { describe, expect, it } from "vitest";
import { REPORT_TOKENS, renderTokens, unknownTokens } from "./reportTokens";
import type { ReportContext } from "./reportTokens";
import type { Client, Module, Project, Sprint } from "./types";

const ctx: ReportContext = {
  client: { name: "UBS Gold", clientPic: "Pak Hendra" } as Client,
  project: { name: "Manufacturing Digital Transformation" } as Project,
  module: {
    name: "OEE Intelligence",
    goal: "Make line performance visible",
    deliveryLead: "Fahmi",
  } as Module,
  sprint: {
    number: 3,
    name: "Alarm Rules",
    goal: "Ship the OEE dashboard",
    startDate: "2026-06-29",
    endDate: "2026-07-10",
    daysLeft: 4,
  } as Sprint,
  metrics: {
    committed: 34,
    completed: 28,
    completionRate: 82,
    inProgress: 3,
    blocked: 2,
    notCompleted: 5,
    openDecisions: 2,
    velocity: 31,
  },
  preparedBy: "Fahmi",
};

describe("renderTokens", () => {
  it("substitutes tokens inside prose", () => {
    expect(
      renderTokens(
        "Sprint {{sprint.number}} for {{client.name}} closed at {{metrics.completionRate}}.",
        ctx
      )
    ).toBe("Sprint 03 for UBS Gold closed at 82%.");
  });

  it("pads the sprint number, because reports say Sprint 03", () => {
    expect(renderTokens("{{sprint.number}}", ctx)).toBe("03");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTokens("{{  client.name  }}", ctx)).toBe("UBS Gold");
  });

  it("leaves an unknown token visible instead of blanking it", () => {
    // A typo should show up in the preview as a typo. Substituting "" would
    // produce a sentence with a silent hole in it.
    expect(renderTokens("Owner: {{client.onwer}}", ctx)).toBe(
      "Owner: {{client.onwer}}"
    );
    expect(unknownTokens("{{client.onwer}} and {{client.name}}")).toEqual([
      "client.onwer",
    ]);
  });

  it("renders a missing client as a dash rather than 'undefined'", () => {
    expect(renderTokens("{{client.name}}", { ...ctx, client: undefined })).toBe(
      "—"
    );
  });

  it("resolves every token it offers", () => {
    // The palette and the resolver read one list, so this cannot drift — but
    // it can still throw on a context field that was never populated.
    for (const token of REPORT_TOKENS) {
      const out = renderTokens(`{{${token.token}}}`, ctx);
      expect(out, token.token).not.toContain("{{");
      expect(out, token.token).not.toBe("undefined");
    }
  });
});
