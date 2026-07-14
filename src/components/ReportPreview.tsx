"use client";

import { AIBadge } from "@/components/AICoachPanel";
import { StatusPill } from "@/components/StatusPill";
import type {
  BacklogItem,
  Product,
  ReportConfig,
  Sprint,
  Task,
} from "@/lib/types";
import {
  burndownInsight,
  dailyUpdates,
  getClient,
  getMember,
  getProject,
  members,
  reportExtras,
  velocity,
} from "@/lib/data";
import { usePrototype } from "@/lib/store";

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h3 className="flex items-baseline gap-3 border-b border-line pb-2 text-sm font-semibold text-ink">
        <span className="tabular-nums text-muted">{number}.</span> {title}
      </h3>
      <div className="mt-3 text-sm leading-relaxed text-ink">{children}</div>
    </section>
  );
}

function MetricRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="py-1.5 text-muted">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{value}</td>
    </tr>
  );
}

function Sections({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <>
      {items.map(([title, body], i) => (
        <Section key={title} number={i + 1} title={title}>
          {body}
        </Section>
      ))}
    </>
  );
}

// Reads live store data so reports reflect this-session board moves and
// runtime-created sprints (not the frozen seed). Safe as a hook: every body
// is a component and calls it unconditionally at the top.
function useReportData(product: Product, sprint: Sprint) {
  const { tasks: allTasks, backlog, decisions } = usePrototype();
  const tasks = allTasks.filter((t) => t.sprintId === sprint.id);
  const backlogItems = sprint.backlogItemIds
    .map((id) => backlog.find((b) => b.id === id))
    .filter((b): b is BacklogItem => !!b);
  return {
    tasks,
    backlogItems,
    completed: tasks.filter((t) => t.column === "done"),
    inProgress: tasks.filter((t) =>
      ["in-progress", "in-review", "qa"].includes(t.column)
    ),
    notCompleted: tasks.filter((t) =>
      ["selected", "ready", "blocked"].includes(t.column)
    ),
    blocked: tasks.filter((t) => t.column === "blocked"),
    completionRate:
      sprint.committed > 0
        ? Math.round((sprint.completed / sprint.committed) * 100)
        : 0,
    openDecisions: decisions.filter(
      (d) => d.status === "open" && d.productId === product.id
    ),
  };
}

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <ul className="space-y-1 text-xs">
      {tasks.length === 0 && <li className="text-muted">—</li>}
      {tasks.map((t) => (
        <li key={t.id}>— {t.title}</li>
      ))}
    </ul>
  );
}

/* ---------- 1. Internal PM: sprint health, workload, risk, capacity ---------- */
function InternalPmBody({ product, sprint }: { product: Product; sprint: Sprint }) {
  const d = useReportData(product, sprint);
  const capacity = sprint.members.reduce((s, m) => s + m.capacityDays, 0);
  return (
    <Sections
      items={[
        [
          "Sprint Health",
          <table key="t" className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-line">
              <MetricRow label="Sprint Goal" value={<span className="text-left">{sprint.goal}</span>} />
              <MetricRow label="Progress" value={`${d.completionRate}%`} />
              <MetricRow label="Days Left" value={sprint.daysLeft} />
              <MetricRow label="Risk" value={sprint.risk} />
              <MetricRow label="Blocked Items" value={d.blocked.length} />
            </tbody>
          </table>,
        ],
        [
          "Capacity vs Commitment",
          <p key="p">
            Sprint capacity is {capacity} mandays across {sprint.members.length}{" "}
            active members. Committed work is {sprint.committed} points with{" "}
            {sprint.committed - sprint.completed} remaining. Watch backend
            capacity — Aditiya is over 100% workload.
          </p>,
        ],
        [
          "Member Workload",
          <table key="t" className="w-full text-xs">
            <tbody className="divide-y divide-line">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="py-1.5 font-medium">{m.name}</td>
                  <td className="py-1.5 text-muted">{m.roleLabel}</td>
                  <td className="py-1.5 tabular-nums">{m.allocation}%</td>
                  <td
                    className={`py-1.5 text-right tabular-nums ${m.workload > 100 ? "font-semibold text-danger" : ""}`}
                  >
                    {m.workload}% load
                  </td>
                </tr>
              ))}
            </tbody>
          </table>,
        ],
        [
          "Blockers & Aging",
          <ul key="u" className="space-y-1">
            {d.blocked.map((t) => (
              <li key={t.id}>
                — {t.title}: {t.blockedReason}{" "}
                {t.blockedDays != null && (
                  <span className="text-danger">
                    (open {t.blockedDays} days)
                  </span>
                )}
              </li>
            ))}
          </ul>,
        ],
        [
          "Velocity",
          <p key="p">
            Last {velocity.length} sprints:{" "}
            {velocity.map((v) => v.completed).join(", ")} points. Recommended
            next commitment: 32–38 points.
          </p>,
        ],
        [
          "Delivery Recommendation",
          <ul key="u" className="space-y-1">
            <li>— Escalate sample data blocker to client PIC today.</li>
            <li>— Move one backend task to Sprint 04 to relieve overload.</li>
            <li>— Add a Data Readiness Gate to the next planning session.</li>
          </ul>,
        ],
      ]}
    />
  );
}

/* ---------- 2. Client Facing: summary, scope, demo, decisions, client actions ---------- */
function ClientFacingBody({ product, sprint }: { product: Product; sprint: Sprint }) {
  const d = useReportData(product, sprint);
  const client = getClient(product.clientId);
  return (
    <Sections
      items={[
        [
          "Executive Summary",
          <p key="p">
            Sprint {String(sprint.number).padStart(2, "0")} focused on{" "}
            {sprint.goal.toLowerCase()} The team completed {sprint.completed} of{" "}
            {sprint.committed} committed points ({d.completionRate}%). Client
            confirmation on downtime categories and sample machine data will
            unblock the remaining validation work.
          </p>,
        ],
        [
          "Completed Scope",
          <TaskList key="l" tasks={d.completed} />,
        ],
        [
          "Demo Result",
          <ul key="u" className="space-y-1">
            {reportExtras.demoItems.map((item) => (
              <li key={item.title}>
                — {item.title}:{" "}
                <span className="text-success">{item.result}</span>
              </li>
            ))}
          </ul>,
        ],
        [
          "Pending Decisions",
          <ul key="u" className="space-y-1">
            {d.openDecisions.map((dec) => (
              <li key={dec.id}>
                — {dec.title} <span className="text-muted">({dec.owner})</span>
              </li>
            ))}
          </ul>,
        ],
        [
          "Risks Requiring Client Action",
          <ul key="u" className="space-y-1">
            {(client?.actionNeeded ?? []).map((action) => (
              <li key={action}>— {action}</li>
            ))}
          </ul>,
        ],
        [
          "Next Sprint Plan",
          <ul key="u" className="space-y-1">
            {reportExtras.nextSprintPlan.map((item) => (
              <li key={item}>— {item}</li>
            ))}
          </ul>,
        ],
      ]}
    />
  );
}

/* ---------- 3. Technical Team: backlog detail, blockers, QA, deploy, debt ---------- */
function TechnicalBody({ product, sprint }: { product: Product; sprint: Sprint }) {
  const d = useReportData(product, sprint);
  const items = d.backlogItems;
  const qa = reportExtras.qaSummary;
  return (
    <Sections
      items={[
        [
          "Sprint Backlog Detail",
          <div key="d" className="space-y-4">
            {items.map((item) => {
              const itemTasks = d.tasks.filter(
                (t) => t.backlogItemId === item.id
              );
              return (
                <div key={item.id}>
                  <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                    {item.title}
                    <span className="font-normal text-muted">
                      {item.estimate} pts
                    </span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {itemTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <span className="w-24 shrink-0">
                          <StatusPill status={t.column} />
                        </span>
                        {t.title}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>,
        ],
        [
          "Technical Blockers",
          <ul key="u" className="space-y-1">
            {d.blocked.map((t) => (
              <li key={t.id}>
                — {t.title}: {t.blockedReason}
              </li>
            ))}
          </ul>,
        ],
        [
          "QA Result",
          <table key="t" className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-line">
              <MetricRow label="QA Passed" value={qa.passed} />
              <MetricRow label="Reopened" value={qa.reopened} />
              <MetricRow label="Pending Verification" value={qa.pendingVerification} />
            </tbody>
          </table>,
        ],
        [
          "Bug / Reopen Notes",
          <p key="p">{qa.reopenReason}</p>,
        ],
        [
          "Deployment Status",
          <p key="p">
            {reportExtras.deployment.environment} —{" "}
            {reportExtras.deployment.status} (last deploy{" "}
            {reportExtras.deployment.lastDeploy}).{" "}
            {reportExtras.deployment.note}
          </p>,
        ],
        [
          "Technical Debt",
          <ul key="u" className="space-y-1">
            {reportExtras.techDebt.map((debt) => (
              <li key={debt}>— {debt}</li>
            ))}
          </ul>,
        ],
      ]}
    />
  );
}

/* ---------- 4. Management: health, timeline risk, utilization, confidence ---------- */
function ManagementBody({ product, sprint }: { product: Product; sprint: Sprint }) {
  const d = useReportData(product, sprint);
  const avgUtilization = Math.round(
    members.reduce((s, m) => s + m.workload, 0) / members.length
  );
  return (
    <Sections
      items={[
        [
          "Module Health",
          <table key="t" className="w-full max-w-md text-sm">
            <tbody className="divide-y divide-line">
              <MetricRow label="Health Score" value={`${product.health}%`} />
              <MetricRow label="Delivery Risk" value={product.risk} />
              <MetricRow label="Sprint Completion" value={`${d.completionRate}%`} />
              <MetricRow
                label="Velocity Trend"
                value={velocity.map((v) => v.completed).join(" → ")}
              />
            </tbody>
          </table>,
        ],
        [
          "Timeline Risk",
          <p key="p">{reportExtras.timelineRisk}</p>,
        ],
        [
          "Resource Utilization",
          <p key="p">
            Average team utilization is {avgUtilization}% across{" "}
            {members.length} members. One backend resource is over capacity
            (110%); documentation capacity has headroom (40%).
          </p>,
        ],
        [
          "Delivery Confidence",
          <p key="p">
            <span className="font-semibold">
              {reportExtras.deliveryConfidence.level}.
            </span>{" "}
            {reportExtras.deliveryConfidence.reason}
          </p>,
        ],
        [
          "Strategic Recommendation",
          <ul key="u" className="space-y-1">
            <li>
              — Hold new scope until client data readiness is resolved; it is
              the single biggest delivery risk.
            </li>
            <li>
              — Consider a shared data-readiness checklist across all UBS Gold
              products.
            </li>
          </ul>,
        ],
      ]}
    />
  );
}

/* ---------- type-override bodies ---------- */

function MemberPerformanceBody({ product, sprint }: { product: Product; sprint: Sprint }) {
  const d = useReportData(product, sprint);
  return (
    <Sections
      items={[
        [
          "Member Workload",
          <table key="t" className="w-full text-xs">
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
                  <td className={`py-2 tabular-nums ${m.workload > 100 ? "font-semibold text-danger" : ""}`}>
                    {m.workload}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>,
        ],
        [
          "Daily Update Consistency",
          <table key="t" className="w-full max-w-md text-xs">
            <tbody className="divide-y divide-line">
              {sprint.members.map((sm) => {
                const member = getMember(sm.memberId);
                const updated = dailyUpdates.some((u) => u.memberId === sm.memberId);
                return (
                  <tr key={sm.memberId}>
                    <td className="py-1.5 font-medium">{member?.name}</td>
                    <td className={`py-1.5 text-right ${updated ? "text-success" : "text-warning"}`}>
                      {updated ? "Consistent" : "Missing updates"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>,
        ],
        [
          "Contribution Notes",
          <ul key="u" className="space-y-1">
            <li>— Reyza carries the largest share of in-flight work ({d.inProgress.length} items in flight overall).</li>
            <li>— Aditiya is over capacity; blocked items skew his numbers, not effort.</li>
            <li>— Use this report for workload balancing, not individual scoring (spec §11.3).</li>
          </ul>,
        ],
      ]}
    />
  );
}

function RiskBody({ product, sprint }: { product: Product; sprint: Sprint }) {
  const d = useReportData(product, sprint);
  const client = getClient(product.clientId);
  return (
    <Sections
      items={[
        [
          "Delivery Risks",
          <ul key="u" className="space-y-1">
            <li>— Client-side data readiness delays core validation work.</li>
            <li>— Downtime category ownership unassigned on client side.</li>
            <li>— {reportExtras.timelineRisk}</li>
          </ul>,
        ],
        [
          "Blockers & Aging",
          <ul key="u" className="space-y-1">
            {d.blocked.length === 0 && <li className="text-muted">No open blockers.</li>}
            {d.blocked.map((t) => (
              <li key={t.id}>
                — {t.title}: {t.blockedReason}{" "}
                {t.blockedDays != null && (
                  <span className="text-danger">(open {t.blockedDays} days)</span>
                )}
              </li>
            ))}
          </ul>,
        ],
        [
          "Client Actions Required",
          <ul key="u" className="space-y-1">
            {(client?.actionNeeded ?? []).map((a) => (
              <li key={a}>— {a}</li>
            ))}
          </ul>,
        ],
        [
          "Mitigations",
          <ul key="u" className="space-y-1">
            <li>— Escalate sample data request to client PIC with a named deadline.</li>
            <li>— Add a Data Readiness Gate to sprint planning.</li>
            <li>— Time-box blocked items: move to next sprint after 3 blocked days.</li>
          </ul>,
        ],
      ]}
    />
  );
}

/* ---------- generic body driven by the Template Master's sections ---------- */

function GenericTemplateBody({
  product,
  sprint,
  sections,
}: {
  product: Product;
  sprint: Sprint;
  sections: string[];
}) {
  const d = useReportData(product, sprint);
  const known: Record<string, React.ReactNode> = {
    "executive summary": (
      <p>
        Sprint {String(sprint.number).padStart(2, "0")} focused on{" "}
        {sprint.goal.toLowerCase()} The team completed {sprint.completed} of{" "}
        {sprint.committed} committed points ({d.completionRate}%).
      </p>
    ),
    velocity: (
      <p>
        Last {velocity.length} sprints: {velocity.map((v) => v.completed).join(", ")}{" "}
        points. Recommended next commitment: 32–38 points.
      </p>
    ),
    "member workload": (
      <table className="w-full max-w-md text-xs">
        <tbody className="divide-y divide-line">
          {members.map((m) => (
            <tr key={m.id}>
              <td className="py-1.5 font-medium">{m.name}</td>
              <td className="py-1.5 text-muted">{m.roleLabel}</td>
              <td className={`py-1.5 text-right tabular-nums ${m.workload > 100 ? "text-danger" : ""}`}>
                {m.workload}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    "completed scope": <TaskList tasks={d.completed} />,
    "blockers & aging": (
      <ul className="space-y-1">
        {d.blocked.map((t) => (
          <li key={t.id}>— {t.title}: {t.blockedReason}</li>
        ))}
      </ul>
    ),
    risks: (
      <ul className="space-y-1">
        <li>— Client-side data readiness delays core validation work.</li>
        <li>— {reportExtras.timelineRisk}</li>
      </ul>
    ),
    milestones: (
      <p>
        Sprint {String(sprint.number).padStart(2, "0")} ({sprint.startDate} →{" "}
        {sprint.endDate}): {sprint.goal}
      </p>
    ),
  };

  return (
    <Sections
      items={sections.map((title) => [
        title,
        known[title.toLowerCase()] ?? (
          <p className="italic text-muted">
            To be completed before sending — no automatic content for this
            section yet.
          </p>
        ),
      ])}
    />
  );
}

const builtinBodies: Record<
  string,
  (props: { product: Product; sprint: Sprint }) => React.ReactNode
> = {
  "Internal PM": InternalPmBody,
  "Client Facing": ClientFacingBody,
  "Technical Team": TechnicalBody,
  Management: ManagementBody,
};

const typeBodies: Record<
  string,
  (props: { product: Product; sprint: Sprint }) => React.ReactNode
> = {
  "Member Performance Report": MemberPerformanceBody,
  "Risk Report": RiskBody,
};

export function ReportPreview({
  product,
  sprint,
  config,
}: {
  product: Product;
  sprint: Sprint;
  config: ReportConfig;
}) {
  const { reportTemplates } = usePrototype();
  const client = getClient(product.clientId);
  const project = getProject(product.projectId);
  const templateDef = reportTemplates.find((t) => t.name === config.template);

  // Resolution order: report type override → built-in template body →
  // generic body rendered from the Template Master's sections.
  const TypeBody = typeBodies[config.type];
  const BuiltinBody = builtinBodies[config.template];
  const audienceLine = templateDef
    ? `${templateDef.visibility === "client-facing" ? "External" : "Internal"} — ${templateDef.audience}`
    : "—";

  return (
    <article className="border border-line bg-paper p-10">
      {/* Document header */}
      <header className="border-b-2 border-black pb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-lg font-bold tracking-tight text-black">WIT</div>
            <div className="label mt-0.5">Sprint OS</div>
          </div>
          <div className="text-right text-xs text-muted">
            <div className="font-medium text-ink">{config.template} Template</div>
            <div className="mt-0.5">{audienceLine}</div>
            <div className="mt-0.5">{config.period}</div>
          </div>
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-ink">
          {config.type}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-muted md:grid-cols-3">
          <div>Client: <span className="text-ink">{client?.name}</span></div>
          <div>Project: <span className="text-ink">{project?.name}</span></div>
          <div>Module: <span className="text-ink">{product.name}</span></div>
          <div>Sprint: <span className="text-ink">Sprint {String(sprint.number).padStart(2, "0")}</span></div>
          <div>Period: <span className="text-ink">{sprint.startDate} → {sprint.endDate}</span></div>
          <div>Prepared by: <span className="text-ink">Fahmi</span></div>
        </div>
      </header>

      {TypeBody ? (
        <TypeBody product={product} sprint={sprint} />
      ) : BuiltinBody ? (
        <BuiltinBody product={product} sprint={sprint} />
      ) : (
        <GenericTemplateBody
          product={product}
          sprint={sprint}
          sections={templateDef?.sections ?? ["Executive Summary"]}
        />
      )}

      <section className="mt-8 border border-line border-l-2 border-l-ai p-5">
        <div className="flex items-center justify-between">
          <AIBadge />
          <span className="text-[10px] uppercase tracking-wide text-muted">
            AI-generated — review before sending
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink">
          {burndownInsight.insight} {burndownInsight.reason} Recommended:{" "}
          {burndownInsight.recommendations.join("; ").toLowerCase()}.
        </p>
      </section>
    </article>
  );
}
