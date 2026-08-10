/**
 * The automatic content a report section can carry.
 *
 * Metadata only — the renderers live in components/ReportBlocks.tsx, keyed by
 * these same strings, so the Settings editor can offer the catalogue without
 * importing the whole report preview. A unit test holds the two sides in step.
 */
export interface ReportBlockMeta {
  key: string;
  label: string;
  group: string;
  describe: string;
}

export const REPORT_BLOCKS: ReportBlockMeta[] = [
  {
    key: "sprintHealth",
    label: "Sprint Health",
    group: "Sprint",
    describe: "Goal, progress, days left, risk and blocked count as a metric table.",
  },
  {
    key: "capacityCommitment",
    label: "Capacity vs Commitment",
    group: "Sprint",
    describe: "Mandays against committed points, naming anyone over capacity.",
  },
  {
    key: "velocity",
    label: "Velocity",
    group: "Sprint",
    describe: "Points completed over recent sprints, with a suggested next commitment.",
  },
  {
    key: "completedScope",
    label: "Completed Scope",
    group: "Sprint",
    describe: "Every task that reached Done this sprint.",
  },
  {
    key: "backlogDetail",
    label: "Sprint Backlog Detail",
    group: "Sprint",
    describe: "Each backlog item with its estimate and the tasks under it.",
  },
  {
    key: "blockers",
    label: "Blockers & Aging",
    group: "Risk",
    describe: "Blocked tasks, why, and how long each has been stuck.",
  },
  {
    key: "timelineRisk",
    label: "Timeline Risk",
    group: "Risk",
    describe: "The module's current timeline risk, in a sentence.",
  },
  {
    key: "clientActions",
    label: "Client Actions Required",
    group: "Risk",
    describe: "What the client still owes, from their profile.",
  },
  {
    key: "pendingDecisions",
    label: "Pending Decisions",
    group: "Risk",
    describe: "Open decisions on this module, with owners.",
  },
  {
    key: "memberWorkload",
    label: "Member Workload",
    group: "People",
    describe: "Every member with role, allocation and workload; over-capacity flagged.",
  },
  {
    key: "resourceUtilization",
    label: "Resource Utilization",
    group: "People",
    describe: "Average utilization, with the highest and lowest loaded members.",
  },
  {
    key: "dailyUpdateConsistency",
    label: "Daily Update Consistency",
    group: "People",
    describe: "Which sprint members have posted daily updates and which have not.",
  },
  {
    key: "qaResult",
    label: "QA Result",
    group: "Engineering",
    describe: "Passed, reopened and pending-verification counts.",
  },
  {
    key: "qaReopenNotes",
    label: "Bug / Reopen Notes",
    group: "Engineering",
    describe: "Why anything was reopened.",
  },
  {
    key: "deploymentStatus",
    label: "Deployment Status",
    group: "Engineering",
    describe: "Environment, status and last deploy.",
  },
  {
    key: "techDebt",
    label: "Technical Debt",
    group: "Engineering",
    describe: "The debt items currently carried.",
  },
  {
    key: "moduleHealth",
    label: "Module Health",
    group: "Management",
    describe: "Health score, delivery risk, sprint completion and velocity trend.",
  },
  {
    key: "deliveryConfidence",
    label: "Delivery Confidence",
    group: "Management",
    describe: "The confidence level and the reasoning behind it.",
  },
  {
    key: "demoResult",
    label: "Demo Result",
    group: "Client",
    describe: "What was demonstrated and how each item landed.",
  },
  {
    key: "nextSprintPlan",
    label: "Next Sprint Plan",
    group: "Client",
    describe: "What the next sprint is expected to cover.",
  },
];

export const reportBlockKeys = new Set(REPORT_BLOCKS.map((b) => b.key));
