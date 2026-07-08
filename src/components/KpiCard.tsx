export function KpiCard({
  value,
  label,
  delta,
  tone = "neutral",
}: {
  value: string | number;
  label: string;
  delta?: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const valueColor =
    tone === "danger"
      ? "text-danger"
      : tone === "warning"
        ? "text-warning"
        : tone === "success"
          ? "text-success"
          : "text-ink";
  return (
    <div className="border border-line bg-paper p-6">
      <div className={`text-5xl font-semibold tracking-tight ${valueColor}`}>
        {value}
      </div>
      <div className="label mt-3">{label}</div>
      {delta && <div className="mt-1 text-xs text-muted">{delta}</div>}
    </div>
  );
}
