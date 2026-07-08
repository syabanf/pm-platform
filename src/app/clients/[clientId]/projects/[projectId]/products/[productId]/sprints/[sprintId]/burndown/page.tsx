import { notFound } from "next/navigation";
import { BurndownChart } from "@/components/BurndownChart";
import { VelocityChart } from "@/components/VelocityChart";
import { CfdChart } from "@/components/CfdChart";
import { AIInsightBlock } from "@/components/AICoachPanel";
import {
  burndown,
  burndownInsight,
  getSprint,
  velocity,
  velocityInsight,
} from "@/lib/data";

export default async function BurndownPage({
  params,
}: {
  params: Promise<{ sprintId: string }>;
}) {
  const { sprintId } = await params;
  const sprint = getSprint(sprintId);
  if (!sprint) notFound();

  const remaining = sprint.committed - sprint.completed;
  const avgVelocity =
    velocity.reduce((sum, v) => sum + v.completed, 0) / velocity.length;

  return (
    <div className="space-y-16">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Burndown
            </h3>
            <p className="mt-1 text-sm text-muted">
              Ideal remaining vs actual remaining, auto-generated from task
              status.
            </p>
          </div>
          <div className="flex gap-8 text-right">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-ink">
                {sprint.committed}
              </div>
              <div className="label mt-0.5">Committed</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-ink">
                {remaining}
              </div>
              <div className="label mt-0.5">Remaining</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-ink">
                {sprint.daysLeft}
              </div>
              <div className="label mt-0.5">Days Left</div>
            </div>
          </div>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="border border-line p-6">
            <BurndownChart data={burndown} />
          </div>
          <AIInsightBlock insight={burndownInsight} />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Velocity
            </h3>
            <p className="mt-1 text-sm text-muted">
              Completed story points per sprint.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums text-ink">
              {avgVelocity.toFixed(2)}
            </div>
            <div className="label mt-0.5">Average Velocity</div>
          </div>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="border border-line p-6">
            <VelocityChart data={velocity} />
          </div>
          <AIInsightBlock insight={velocityInsight} />
        </div>
      </section>

      <section>
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            Cumulative Flow
          </h3>
          <p className="mt-1 text-sm text-muted">
            Points per state per sprint day. A widening grey band means work in
            progress is piling up faster than it finishes.
          </p>
        </div>
        <div className="mt-8 max-w-3xl border border-line p-6">
          <CfdChart />
        </div>
      </section>
    </div>
  );
}
