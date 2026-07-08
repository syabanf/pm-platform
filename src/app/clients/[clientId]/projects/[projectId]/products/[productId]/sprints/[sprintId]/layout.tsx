import { notFound } from "next/navigation";
import { PageTabs } from "@/components/PageTabs";
import { StatusPill } from "@/components/StatusPill";
import { getSprint, sprintPath } from "@/lib/data";

export default async function SprintLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ productId: string; sprintId: string }>;
}) {
  const { productId, sprintId } = await params;
  const sprint = getSprint(sprintId);
  if (!sprint || sprint.productId !== productId) notFound();
  const base = sprintPath(sprint);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border border-black p-5">
        <div>
          <div className="label">
            Sprint {String(sprint.number).padStart(2, "0")} — Sprint Goal
          </div>
          <p className="mt-1 text-base font-medium text-ink">{sprint.goal}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs tabular-nums text-muted">
            {sprint.daysLeft > 0 ? `${sprint.daysLeft} days left` : "Completed"}
          </span>
          <StatusPill status={sprint.status} />
        </div>
      </div>

      <div className="mt-6">
        <PageTabs
          tabs={[
            { label: "Planning", href: `${base}/planning` },
            { label: "Board", href: `${base}/board` },
            { label: "Daily", href: `${base}/daily` },
            { label: "Charts", href: `${base}/burndown` },
            { label: "Review", href: `${base}/review` },
            { label: "Retro", href: `${base}/retro` },
          ]}
        />
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}
