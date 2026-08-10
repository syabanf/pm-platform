import { describe, expect, it } from "vitest";
import { REPORT_BLOCKS } from "./reportBlocks";
import { reportBlockRenderers } from "@/components/ReportBlocks";
import { reportTemplateMaster } from "./data";

describe("report blocks", () => {
  it("offers exactly the blocks it can render", () => {
    // The Settings editor lists REPORT_BLOCKS and the preview looks up
    // reportBlockRenderers. A block in one and not the other is either a
    // choice that renders nothing or a renderer nobody can reach.
    expect(REPORT_BLOCKS.map((b) => b.key).sort()).toEqual(
      Object.keys(reportBlockRenderers).sort()
    );
  });

  it("has no duplicate keys", () => {
    const keys = REPORT_BLOCKS.map((b) => b.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("seeded templates", () => {
  const sections = reportTemplateMaster.flatMap((t) =>
    t.sections.map((s) => ({ template: t.name, ...s }))
  );

  it("only reference blocks that exist", () => {
    for (const section of sections) {
      if (!section.autoBlock) continue;
      expect(
        Object.keys(reportBlockRenderers),
        `${section.template} → ${section.title}`
      ).toContain(section.autoBlock);
    }
  });

  it("leave no section without content", () => {
    // A section with neither a block nor a narrative renders a heading over a
    // "to be completed" placeholder — fine for a template someone is still
    // writing, never right for a seeded one.
    for (const section of sections) {
      expect(
        Boolean(section.autoBlock || section.body.trim()),
        `${section.template} → ${section.title}`
      ).toBe(true);
    }
  });

  it("give every section within a template a distinct id", () => {
    for (const template of reportTemplateMaster) {
      const ids = template.sections.map((s) => s.id);
      expect(new Set(ids).size, template.name).toBe(ids.length);
    }
  });
});
