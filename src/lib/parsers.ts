// Pure text parsers behind the document generators. Kept framework-free so
// they are unit-testable and reusable.

export interface MomActionItem {
  text: string;
  owner: string;
  due: string;
}

export interface ParsedMom {
  notes: string[];
  decisions: string[];
  actions: MomActionItem[];
  questions: string[];
}

const MOM_DECISION_RE = /(decided|decision|agreed|approved|confirmed|finaliz)/i;
const MOM_ACTION_RE =
  /\b(will|to provide|to send|to prepare|to update|to share|to schedule|action|follow[- ]up|needs to|must|to do)\b/i;

const stripBullet = (line: string) =>
  line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim();

export function parseMomBullets(raw: string, attendees: string[]): ParsedMom {
  const lines = raw.split("\n").map(stripBullet).filter(Boolean);
  const parsed: ParsedMom = {
    notes: [],
    decisions: [],
    actions: [],
    questions: [],
  };

  for (const line of lines) {
    if (/\?\s*$/.test(line)) {
      parsed.questions.push(line);
    } else if (MOM_DECISION_RE.test(line)) {
      parsed.decisions.push(line);
    } else if (MOM_ACTION_RE.test(line)) {
      const owner =
        attendees.find((a) => line.toLowerCase().includes(a.toLowerCase())) ??
        "Unassigned";
      const due = line.match(/\bby ([^,.;]+?)(?:[,.;]|$)/i)?.[1]?.trim() ?? "—";
      parsed.actions.push({ text: line, owner, due });
    } else {
      parsed.notes.push(line);
    }
  }
  return parsed;
}

export interface ParsedUpdate {
  done: string[];
  inFlight: string[];
  blockers: string[];
  asks: string[];
}

const UPDATE_BLOCKER_RE = /(blocked|blocker|waiting|stuck|delayed|on hold|risk)/i;
// Checked before DONE so "60% done" style progress notes stay in flight.
const UPDATE_PROGRESS_RE = /(in progress|still|ongoing|wip|\d+\s*%)/i;
const UPDATE_DONE_RE =
  /(finished|completed|done|shipped|delivered|deployed|fixed|passed|validated)/i;
const UPDATE_ASK_RE = /^(need|please|require|request)|(?:need|please provide|require)\b/i;

export function parseStatusUpdate(raw: string): ParsedUpdate {
  const lines = raw.split("\n").map(stripBullet).filter(Boolean);
  const parsed: ParsedUpdate = { done: [], inFlight: [], blockers: [], asks: [] };

  for (const line of lines) {
    if (UPDATE_ASK_RE.test(line)) parsed.asks.push(line);
    else if (UPDATE_BLOCKER_RE.test(line)) parsed.blockers.push(line);
    else if (UPDATE_PROGRESS_RE.test(line)) parsed.inFlight.push(line);
    else if (UPDATE_DONE_RE.test(line)) parsed.done.push(line);
    else parsed.inFlight.push(line);
  }
  return parsed;
}
