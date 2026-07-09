const toneMap: Record<string, string> = {
  healthy: "text-success border-success/30",
  done: "text-success border-success/30",
  active: "text-success border-success/30",
  ready: "text-success border-success/30",
  decided: "text-success border-success/30",
  low: "text-success border-success/30",
  warning: "text-warning border-warning/30",
  medium: "text-warning border-warning/30",
  "needs-clarification": "text-warning border-warning/30",
  "in-progress": "text-ink border-line",
  planning: "text-ink border-line",
  review: "text-ink border-line",
  discovery: "text-muted border-line",
  planned: "text-muted border-line",
  draft: "text-muted border-line",
  open: "text-warning border-warning/30",
  "at-risk": "text-danger border-danger/30",
  high: "text-danger border-danger/30",
  blocked: "text-danger border-danger/30",
  overloaded: "text-danger border-danger/30",
  development: "text-ink border-line",
  maintenance: "text-muted border-line",
  release: "text-success border-success/30",
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
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = toneMap[status] ?? "text-muted border-line";
  const title = titleMap[status];
  return (
    <span
      title={title}
      className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {label ?? status.replace(/-/g, " ")}
    </span>
  );
}
