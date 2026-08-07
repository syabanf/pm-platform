import { AIInsightBlock, AIBadge } from "@/components/AICoachPanel";
import { StatusPill } from "@/components/StatusPill";
import { retroData } from "@/lib/data";

export default function SprintRetroPage() {
  const doneActions = retroData.actions.filter((a) => a.status === "done").length;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            Sprint Retrospective
          </h3>
          <p className="mt-1 text-sm text-muted">
            Improve how the team works, sprint over sprint. Every improvement
            gets an owner and a due date.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-ink">
            {doneActions}/{retroData.actions.length}
          </div>
          <div className="label mt-0.5">Actions Completed</div>
        </div>
      </div>

      <div className="mt-8 grid gap-12 md:grid-cols-2">
        <section>
          <h4 className="label text-success">Went Well</h4>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {retroData.wentWell.map((item) => (
              <li key={item} className="flex items-center gap-3 py-3">
                <span className="h-1.5 w-1.5 shrink-0 bg-success" />
                <span className="text-sm text-ink">{item}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="label text-warning">Needs Improvement</h4>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {retroData.needsImprovement.map((item) => (
              <li key={item} className="flex items-center gap-3 py-3">
                <span className="h-1.5 w-1.5 shrink-0 bg-warning" />
                <span className="text-sm text-ink">{item}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-12">
        <h4 className="label">Retro Actions — Owner & Due Date</h4>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {retroData.actions.map((action) => (
            <li
              key={action.action}
              className="grid gap-2 py-4 md:grid-cols-[1fr_120px_110px_auto] md:items-center md:gap-6"
            >
              <span className="text-sm text-ink">{action.action}</span>
              <span className="text-sm text-muted">{action.owner}</span>
              <span className="text-xs tabular-nums text-muted">
                {action.due}
              </span>
              <StatusPill status={action.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 grid gap-12 md:grid-cols-2">
        <div>
          <h4 className="label">Root Cause AI</h4>
          <div className="mt-3">
            <AIInsightBlock insight={retroData.rootCause} />
          </div>
        </div>
        <div>
          <h4 className="label">Retro Memory</h4>
          <div className="mt-3 border border-line border-l-2 border-l-ai p-5">
            <AIBadge />
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {retroData.memory}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
