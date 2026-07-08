import { DataTable } from "@/components/DataTable";
import { AIInsightBlock } from "@/components/AICoachPanel";
import { dailyInsight, dailyUpdates, getMember, getSprint } from "@/lib/data";
import { notFound } from "next/navigation";

const confidenceTone = {
  high: "text-success",
  medium: "text-warning",
  low: "text-danger",
} as const;

export default async function DailyScrumPage({
  params,
}: {
  params: Promise<{ sprintId: string }>;
}) {
  const { sprintId } = await params;
  const sprint = getSprint(sprintId);
  if (!sprint) notFound();

  const day = sprint.workingDays - sprint.daysLeft;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            Daily Scrum — Day {day}
          </h3>
          <p className="mt-1 text-sm text-muted">
            Inspect progress toward the Sprint Goal, then adapt the plan.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-ink">
            {Math.round((sprint.completed / sprint.committed) * 100)}%
          </div>
          <div className="label mt-0.5">Progress to Sprint Goal</div>
        </div>
      </div>

      <div className="mt-8">
        <DataTable
          headers={["Member", "Yesterday", "Today", "Blocker", "Confidence"]}
        >
          {dailyUpdates.map((update) => {
            const member = getMember(update.memberId);
            return (
              <tr key={update.memberId}>
                <td className="py-4 pr-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center bg-soft text-[11px] font-semibold text-ink">
                      {member?.name.charAt(0)}
                    </span>
                    <span className="font-medium text-ink">{member?.name}</span>
                  </div>
                </td>
                <td className="py-4 pr-6 text-muted">{update.yesterday}</td>
                <td className="py-4 pr-6 text-ink">{update.today}</td>
                <td className="py-4 pr-6">
                  {update.blocker ? (
                    <span className="text-danger">{update.blocker}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td
                  className={`py-4 font-medium capitalize ${confidenceTone[update.confidence]}`}
                >
                  {update.confidence}
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>

      <div className="mt-10 max-w-xl">
        <h4 className="label">AI Daily Summary</h4>
        <div className="mt-3">
          <AIInsightBlock insight={dailyInsight} />
        </div>
      </div>
    </div>
  );
}
