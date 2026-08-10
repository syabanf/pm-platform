"use client";

import { StatusPill } from "@/components/StatusPill";
import type {
  BacklogItem,
  Client,
  Decision,
  Member,
  Module,
  Sprint,
  Task,
} from "@/lib/types";
import { dailyUpdates, reportExtras, velocity } from "@/lib/data";

/** Every reason a task is stuck, in one line a client can read. */
const blockerSummary = (t: { blockers: { text: string }[] }) =>
  t.blockers.map((b) => b.text).join("; ") || "Blocked";

/** How long the task has really been stuck: its oldest blocker. */
const oldestBlocker = (t: { blockers: { days?: number }[] }) =>
  t.blockers.reduce((max, b) => Math.max(max, b.days ?? 0), 0);

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="py-1.5 text-muted">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function Metrics({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full max-w-md text-sm">
      <tbody className="divide-y divide-line">{children}</tbody>
    </table>
  );
}

function Bullets({ items, empty }: { items: React.ReactNode[]; empty: string }) {
  return (
    <ul className="space-y-1">
      {items.length === 0 && <li className="text-muted">{empty}</li>}
      {items.map((item, i) => (
        <li key={i}>— {item}</li>
      ))}
    </ul>
  );
}

/** What every block is handed. Assembled once by the preview. */
export interface ReportBlockProps {
  module: Module;
  sprint: Sprint;
  client?: Client;
  tasks: Task[];
  backlogItems: BacklogItem[];
  completed: Task[];
  inProgress: Task[];
  blocked: Task[];
  completionRate: number;
  openDecisions: Decision[];
  members: Member[];
}

type Block = (p: ReportBlockProps) => React.ReactNode;

const sprintHealth: Block = ({ sprint, completionRate, blocked }) => (
  <Metrics>
    <MetricRow label="Sprint Goal" value={sprint.goal} />
    <MetricRow label="Progress" value={`${completionRate}%`} />
    <MetricRow label="Days Left" value={sprint.daysLeft} />
    <MetricRow label="Risk" value={sprint.risk} />
    <MetricRow label="Blocked Items" value={blocked.length} />
  </Metrics>
);

const capacityCommitment: Block = ({ sprint, members }) => {
  const capacity = sprint.members.reduce((s, m) => s + m.capacityDays, 0);
  // Named from the data. This sentence used to say "Aditiya is over 100%
  // workload" in the source, which stayed true only for the seed.
  const over = members.filter((m) => m.workload > 100);
  return (
    <p>
      Sprint capacity is {capacity} mandays across {sprint.members.length} active
      members. Committed work is {sprint.committed} points with{" "}
      {sprint.committed - sprint.completed} remaining.
      {over.length > 0 && (
        <>
          {" "}
          Watch capacity — {over.map((m) => m.name).join(", ")}{" "}
          {over.length === 1 ? "is" : "are"} over 100% workload.
        </>
      )}
    </p>
  );
};

const memberWorkload: Block = ({ members }) => (
  <table className="w-full text-xs">
    <thead>
      <tr className="border-b border-black text-left">
        <th className="label py-2 pr-4 font-medium">Member</th>
        <th className="label py-2 pr-4 font-medium">Role</th>
        <th className="label py-2 pr-4 font-medium">Allocation</th>
        <th className="label py-2 font-medium">Workload</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-line">
      {members.map((m) => (
        <tr key={m.id}>
          <td className="py-2 pr-4 font-medium">{m.name}</td>
          <td className="py-2 pr-4 text-muted">{m.roleLabel}</td>
          <td className="py-2 pr-4 tabular-nums">{m.allocation}%</td>
          <td
            className={`py-2 tabular-nums ${m.workload > 100 ? "font-semibold text-danger" : ""}`}
          >
            {m.workload}%
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const blockers: Block = ({ blocked }) => (
  <Bullets
    empty="No open blockers."
    items={blocked.map((t) => (
      <span key={t.id}>
        {t.title}: {blockerSummary(t)}{" "}
        {oldestBlocker(t) > 0 && (
          <span className="text-danger">(open {oldestBlocker(t)} days)</span>
        )}
      </span>
    ))}
  />
);

const velocityBlock: Block = () => (
  <p>
    Last {velocity.length} sprints:{" "}
    {velocity.map((v) => v.completed).join(", ")} points. Recommended next
    commitment: 32–38 points.
  </p>
);

const completedScope: Block = ({ completed }) => (
  <Bullets empty="—" items={completed.map((t) => t.title)} />
);

const backlogDetail: Block = ({ backlogItems, tasks }) => (
  <div className="space-y-4">
    {backlogItems.length === 0 && (
      <p className="text-muted">No backlog items in this sprint.</p>
    )}
    {backlogItems.map((item) => (
      <div key={item.id}>
        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
          {item.title}
          <span className="font-normal text-muted">{item.estimate} pts</span>
        </div>
        <ul className="mt-1 space-y-0.5 text-xs">
          {tasks
            .filter((t) => t.backlogItemId === item.id)
            .map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0">
                  <StatusPill status={t.column} />
                </span>
                {t.title}
              </li>
            ))}
        </ul>
      </div>
    ))}
  </div>
);

const timelineRisk: Block = () => <p>{reportExtras.timelineRisk}</p>;

const clientActions: Block = ({ client }) => (
  <Bullets
    empty="Nothing outstanding on the client side."
    items={client?.actionNeeded ?? []}
  />
);

const pendingDecisions: Block = ({ openDecisions }) => (
  <Bullets
    empty="No decisions outstanding."
    items={openDecisions.map((d) => (
      <span key={d.id}>
        {d.title} <span className="text-muted">({d.owner})</span>
      </span>
    ))}
  />
);

const resourceUtilization: Block = ({ members }) => {
  if (members.length === 0) return <p className="text-muted">No members.</p>;
  const average = Math.round(
    members.reduce((s, m) => s + m.workload, 0) / members.length
  );
  // The busiest and the quietest, rather than the two figures this paragraph
  // used to state literally regardless of who was actually loaded.
  const sorted = [...members].sort((a, b) => b.workload - a.workload);
  const busiest = sorted[0];
  const quietest = sorted[sorted.length - 1];
  return (
    <p>
      Average team utilization is {average}% across {members.length} members.{" "}
      {busiest.name} carries the most at {busiest.workload}%
      {quietest.id !== busiest.id && (
        <>
          ; {quietest.name} has the most headroom at {quietest.workload}%
        </>
      )}
      .
    </p>
  );
};

const dailyUpdateConsistency: Block = ({ sprint, members }) => (
  <table className="w-full max-w-md text-xs">
    <tbody className="divide-y divide-line">
      {sprint.members.map((sm) => {
        const member = members.find((m) => m.id === sm.memberId);
        const updated = dailyUpdates.some((u) => u.memberId === sm.memberId);
        return (
          <tr key={sm.memberId}>
            <td className="py-1.5 font-medium">{member?.name ?? sm.memberId}</td>
            <td
              className={`py-1.5 text-right ${updated ? "text-success" : "text-warning"}`}
            >
              {updated ? "Consistent" : "Missing updates"}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const qaResult: Block = () => {
  const qa = reportExtras.qaSummary;
  return (
    <Metrics>
      <MetricRow label="QA Passed" value={qa.passed} />
      <MetricRow label="Reopened" value={qa.reopened} />
      <MetricRow label="Pending Verification" value={qa.pendingVerification} />
    </Metrics>
  );
};

const qaReopenNotes: Block = () => <p>{reportExtras.qaSummary.reopenReason}</p>;

const deploymentStatus: Block = () => (
  <p>
    {reportExtras.deployment.environment} — {reportExtras.deployment.status}{" "}
    (last deploy {reportExtras.deployment.lastDeploy}).{" "}
    {reportExtras.deployment.note}
  </p>
);

const techDebt: Block = () => (
  <Bullets empty="None recorded." items={reportExtras.techDebt} />
);

const moduleHealth: Block = ({ module: mod, completionRate }) => (
  <Metrics>
    <MetricRow label="Health Score" value={`${mod.health}%`} />
    <MetricRow label="Delivery Risk" value={mod.risk} />
    <MetricRow label="Sprint Completion" value={`${completionRate}%`} />
    <MetricRow
      label="Velocity Trend"
      value={velocity.map((v) => v.completed).join(" → ")}
    />
  </Metrics>
);

const deliveryConfidence: Block = () => (
  <p>
    <span className="font-semibold">
      {reportExtras.deliveryConfidence.level}.
    </span>{" "}
    {reportExtras.deliveryConfidence.reason}
  </p>
);

const demoResult: Block = () => (
  <Bullets
    empty="Nothing demonstrated."
    items={reportExtras.demoItems.map((item) => (
      <span key={item.title}>
        {item.title}: <span className="text-success">{item.result}</span>
      </span>
    ))}
  />
);

const nextSprintPlan: Block = () => (
  <Bullets empty="Not planned yet." items={reportExtras.nextSprintPlan} />
);

/** Keyed by the same strings as `REPORT_BLOCKS` in lib/reportBlocks. */
export const reportBlockRenderers: Record<string, Block | undefined> = {
  sprintHealth,
  capacityCommitment,
  memberWorkload,
  blockers,
  velocity: velocityBlock,
  completedScope,
  backlogDetail,
  timelineRisk,
  clientActions,
  pendingDecisions,
  resourceUtilization,
  dailyUpdateConsistency,
  qaResult,
  qaReopenNotes,
  deploymentStatus,
  techDebt,
  moduleHealth,
  deliveryConfidence,
  demoResult,
  nextSprintPlan,
};
