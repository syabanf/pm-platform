import { describe, expect, it } from "vitest";
import { parseMomBullets, parseStatusUpdate } from "./parsers";

describe("parseMomBullets", () => {
  const attendees = ["Fahmi", "Aditiya", "Pak Hendra"];

  it("classifies decisions, actions, questions, and notes", () => {
    const parsed = parseMomBullets(
      [
        "- Reviewed dashboard progress",
        "- Client agreed the OEE formula is valid",
        "- Aditiya will validate the API by Friday",
        "- Who owns the downtime categories?",
      ].join("\n"),
      attendees
    );
    expect(parsed.notes).toEqual(["Reviewed dashboard progress"]);
    expect(parsed.decisions).toEqual(["Client agreed the OEE formula is valid"]);
    expect(parsed.actions).toHaveLength(1);
    expect(parsed.questions).toEqual(["Who owns the downtime categories?"]);
  });

  it("extracts action owner from attendees and due from 'by …'", () => {
    const parsed = parseMomBullets(
      "- Pak Hendra to provide sample machine data by 11 July",
      attendees
    );
    expect(parsed.actions[0]).toMatchObject({
      owner: "Pak Hendra",
      due: "11 July",
    });
  });

  it("marks unowned actions as Unassigned with no due date", () => {
    const parsed = parseMomBullets("- Someone must fix the export", attendees);
    expect(parsed.actions[0]).toMatchObject({ owner: "Unassigned", due: "—" });
  });

  it("strips -, *, • and numbered bullet markers", () => {
    const parsed = parseMomBullets(
      "* starred note\n• dotted note\n2) numbered note",
      []
    );
    expect(parsed.notes).toEqual([
      "starred note",
      "dotted note",
      "numbered note",
    ]);
  });

  it("ignores empty lines", () => {
    const parsed = parseMomBullets("\n\n- one note\n\n", []);
    expect(parsed.notes).toEqual(["one note"]);
  });
});

describe("parseStatusUpdate", () => {
  it("classifies done, in flight, blockers, and asks", () => {
    const parsed = parseStatusUpdate(
      [
        "- Finished the preview table",
        "- Dashboard UI still in progress",
        "- Blocked: waiting for sample data",
        "- Need client to assign an owner",
      ].join("\n")
    );
    expect(parsed.done).toHaveLength(1);
    expect(parsed.inFlight).toHaveLength(1);
    expect(parsed.blockers).toHaveLength(1);
    expect(parsed.asks).toHaveLength(1);
  });

  it("keeps '60% done' progress notes in flight, not done (regression)", () => {
    const parsed = parseStatusUpdate("- Dashboard UI still in progress, 60% done");
    expect(parsed.inFlight).toHaveLength(1);
    expect(parsed.done).toHaveLength(0);
  });

  it("prioritizes ask over blocker wording", () => {
    const parsed = parseStatusUpdate("- Please unblock the API access");
    expect(parsed.asks).toHaveLength(1);
    expect(parsed.blockers).toHaveLength(0);
  });

  it("defaults unmatched lines to in flight", () => {
    const parsed = parseStatusUpdate("- Preparing the demo script");
    expect(parsed.inFlight).toEqual(["Preparing the demo script"]);
  });
});
