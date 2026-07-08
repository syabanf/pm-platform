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

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = toneMap[status] ?? "text-muted border-line";
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide whitespace-nowrap ${tone}`}
    >
      {label ?? status.replace(/-/g, " ")}
    </span>
  );
}
