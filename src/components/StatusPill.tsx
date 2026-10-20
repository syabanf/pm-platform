const toneMap: Record<string, string> = {
  healthy: "bg-success-soft text-success",
  done: "bg-success-soft text-success",
  active: "bg-success-soft text-success",
  ready: "bg-success-soft text-success",
  decided: "bg-success-soft text-success",
  low: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  medium: "bg-warning-soft text-warning",
  "needs-clarification": "bg-warning-soft text-warning",
  "in-progress": "bg-info-soft text-info",
  planning: "bg-info-soft text-info",
  review: "bg-info-soft text-info",
  discovery: "bg-surface text-muted",
  planned: "bg-surface text-muted",
  draft: "bg-surface text-muted",
  open: "bg-warning-soft text-warning",
  "at-risk": "bg-danger-soft text-danger",
  high: "bg-danger-soft text-danger",
  blocked: "bg-danger-soft text-danger",
  overloaded: "bg-danger-soft text-danger",
  development: "bg-info-soft text-info",
  maintenance: "bg-surface text-muted",
  release: "bg-success-soft text-success",
  // Reachable and previously silent: "On Hold" is in the project status
  // dropdown, and selected / in-review / qa are board columns the Technical
  // Team report renders per task. All four fell through to plain grey with no
  // tooltip, next to siblings that were coloured.
  "on-hold": "bg-warning-soft text-warning",
  selected: "bg-surface text-muted",
  "in-review": "bg-info-soft text-info",
  qa: "bg-info-soft text-info",
  inactive: "bg-surface text-muted",
  temporary: "bg-info-soft text-info",
  prospect: "bg-info-soft text-info",
};

// Plain-language meaning shown on hover/long-press — a lightweight status legend.
const titleMap: Record<string, string> = {
  healthy: "Healthy — on track",
  done: "Done — completed",
  active: "Active — in progress",
  ready: "Ready — meets Definition of Ready",
  decided: "Decided — decision closed",
  low: "Low risk",
  warning: "Warning — needs attention soon",
  medium: "Medium risk",
  "needs-clarification": "Needs clarification before sprint planning",
  "in-progress": "In progress",
  planning: "In planning",
  review: "In review",
  discovery: "Discovery phase",
  planned: "Planned — not started",
  draft: "Draft — not yet refined",
  open: "Open — awaiting action",
  "at-risk": "At risk — may miss its goal",
  high: "High risk",
  blocked: "Blocked — cannot proceed",
  overloaded: "Overloaded — above capacity",
  development: "In development",
  maintenance: "In maintenance",
  release: "Released",
  "on-hold": "On hold — paused, not cancelled",
  selected: "Selected — committed to this sprint",
  "in-review": "In review — awaiting code review",
  qa: "In QA",
  inactive: "Inactive — not on delivery",
  temporary: "Temporary — short-term assignment",
  prospect: "Prospect — not yet a client",
};

export const statusTones = toneMap;
export const statusTitles = titleMap;

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = toneMap[status] ?? "bg-surface text-muted";
  const title = titleMap[status];
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {label ?? status.replace(/-/g, " ")}
    </span>
  );
}
