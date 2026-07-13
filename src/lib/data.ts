import type {
  AIInsight,
  BacklogItem,
  BurndownPoint,
  Client,
  DailyUpdate,
  Decision,
  Member,
  Product,
  Project,
  Sprint,
  Task,
  VelocityEntry,
} from "./types";

export const workspace = {
  name: "WIT Sprint OS",
  user: "Fahmi",
};

// ---------- master data seeds (Settings) ----------

export const workspaceDefaults = {
  name: "WIT Sprint OS",
  company: "WIT ID",
  brandColor: "#ED1C24",
  sprintLengthDays: 10,
  workingDaysPerWeek: 5,
};

export const permissionCapabilities = [
  "Manage workspace",
  "Manage clients & projects",
  "Manage modules & sprints",
  "Edit backlog",
  "Update tasks & daily updates",
  "Manage QA status",
  "Generate & send reports",
  "View client-facing pages",
] as const;

export interface RoleDef {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
}

const perms = (granted: number[]): Record<string, boolean> =>
  Object.fromEntries(
    permissionCapabilities.map((c, i) => [c, granted.includes(i)])
  );

export const roleMatrix: RoleDef[] = [
  { id: "admin", name: "Workspace Admin", permissions: perms([0, 1, 2, 3, 4, 5, 6, 7]) },
  { id: "pm", name: "Delivery Lead / PM", permissions: perms([1, 2, 3, 4, 6, 7]) },
  { id: "po", name: "Product Owner", permissions: perms([3, 7]) },
  { id: "sm", name: "Scrum Master", permissions: perms([2, 3, 4]) },
  { id: "dev", name: "Developer", permissions: perms([4]) },
  { id: "qa", name: "QA", permissions: perms([4, 5]) },
  { id: "uiux", name: "UI/UX", permissions: perms([4]) },
  { id: "writer", name: "Technical Writer", permissions: perms([4, 6]) },
  { id: "client", name: "Client Viewer", permissions: perms([7]) },
  { id: "stakeholder", name: "Stakeholder Reviewer", permissions: perms([7]) },
];

export interface ReportTemplateDef {
  id: string;
  name: string;
  audience: string;
  frequency: string;
  visibility: "internal" | "client-facing";
  formats: string[];
  sections: string[];
}

export const reportTemplateMaster: ReportTemplateDef[] = [
  {
    id: "tpl-internal-pm",
    name: "Internal PM",
    audience: "Delivery team",
    frequency: "Sprint-end",
    visibility: "internal",
    formats: ["Markdown", "PDF"],
    sections: [
      "Sprint Health",
      "Capacity vs Commitment",
      "Member Workload",
      "Blockers & Aging",
      "Velocity",
      "Delivery Recommendation",
    ],
  },
  {
    id: "tpl-client-facing",
    name: "Client Facing",
    audience: "Client stakeholders",
    frequency: "Sprint-end / Monthly",
    visibility: "client-facing",
    formats: ["Markdown", "PDF"],
    sections: [
      "Executive Summary",
      "Completed Scope",
      "Demo Result",
      "Pending Decisions",
      "Risks Requiring Client Action",
      "Next Sprint Plan",
    ],
  },
  {
    id: "tpl-technical",
    name: "Technical Team",
    audience: "Engineering",
    frequency: "Sprint-end",
    visibility: "internal",
    formats: ["Markdown"],
    sections: [
      "Sprint Backlog Detail",
      "Technical Blockers",
      "QA Result",
      "Bug / Reopen Notes",
      "Deployment Status",
      "Technical Debt",
    ],
  },
  {
    id: "tpl-management",
    name: "Management",
    audience: "Leadership",
    frequency: "Monthly",
    visibility: "internal",
    formats: ["Markdown", "PDF"],
    sections: [
      "Module Health",
      "Timeline Risk",
      "Resource Utilization",
      "Delivery Confidence",
      "Strategic Recommendation",
    ],
  },
];

export const defaultDodTemplate = [
  "Code reviewed",
  "Tests passing",
  "QA passed",
  "Documentation updated",
];

export const masterLists = {
  industries: [
    "Manufacturing",
    "Banking",
    "Heavy Equipment Rental",
    "Automotive",
    "Retail",
    "Logistics",
  ],
  contractTypes: ["Retainer", "Fixed scope", "Project-based"],
  jobRoles: [
    "Delivery Lead",
    "System Analyst",
    "Fullstack Developer",
    "Backend Developer",
    "Frontend Developer",
    "QA Engineer",
    "UI/UX Designer",
    "Technical Writer",
  ],
  skillTags: ["FE", "BE", "QA", "Data", "AI", "Infra", "Documentation"],
  workItemTypes: ["story", "bug", "task", "spike"],
  priorities: ["high", "medium", "low"],
  impactAreas: ["Scope", "Timeline", "Cost", "Quality"],
};

export type MasterListKey = keyof typeof masterLists;

export const masterListMeta: Record<
  MasterListKey,
  { title: string; usedBy: string }
> = {
  industries: { title: "Industries", usedBy: "Client profile" },
  contractTypes: { title: "Contract Types", usedBy: "Client profile" },
  jobRoles: { title: "Job Roles", usedBy: "Member master" },
  skillTags: { title: "Skill Tags", usedBy: "Member master" },
  workItemTypes: { title: "Work Item Types", usedBy: "Module backlog" },
  priorities: { title: "Priorities", usedBy: "Backlog & tasks" },
  impactAreas: { title: "Impact Areas", usedBy: "Change requests" },
};

export const clients: Client[] = [
  {
    id: "ubs-gold",
    name: "UBS Gold",
    industry: "Manufacturing",
    status: "active",
    clientPic: "Pak Hendra",
    witOwner: "Fahmi",
    contractType: "Retainer",
    health: "warning",
    risk: "medium",
    notes: "Data readiness on client side is the recurring constraint.",
    actionNeeded: [
      "Confirm downtime category",
      "Provide sample machine data",
      "Validate OEE formula",
    ],
    aiInsight:
      "Most blockers are related to data readiness and unclear ownership.",
  },
  {
    id: "bsm",
    name: "BSM",
    industry: "Heavy Equipment Rental",
    status: "active",
    clientPic: "Ibu Sari",
    witOwner: "Fahmi",
    contractType: "Fixed scope",
    health: "healthy",
    risk: "low",
    notes: "Rental Management Platform in steady delivery.",
    actionNeeded: ["Review Sprint 04 module report"],
    aiInsight: "Delivery is stable. Keep sprint commitment within velocity.",
  },
  {
    id: "bni",
    name: "BNI",
    industry: "Banking",
    status: "active",
    clientPic: "Pak Dimas",
    witOwner: "Fahmi",
    contractType: "Project-based",
    health: "healthy",
    risk: "low",
    notes: "Knowledge platform discovery completed.",
    actionNeeded: [],
    aiInsight: "No active risks. Next milestone is UAT preparation.",
  },
];

export const projects: Project[] = [
  {
    id: "ubs-mdt",
    clientId: "ubs-gold",
    name: "Manufacturing Digital Transformation",
    objective: "Digitalize production monitoring and quality control.",
    status: "active",
  },
  {
    id: "bsm-rental",
    clientId: "bsm",
    name: "Rental Operations Digitalization",
    objective: "Digitalize rental, service, and invoicing operations.",
    status: "active",
  },
  {
    id: "bni-knowledge",
    clientId: "bni",
    name: "Internal Knowledge Platform",
    objective: "Centralize internal knowledge with AI search.",
    status: "active",
  },
];

export const members: Member[] = [
  {
    id: "fahmi",
    name: "Fahmi",
    email: "fahmi@wit.id",
    role: "PM",
    roleLabel: "Delivery Lead",
    skillTags: ["PM", "Documentation"],
    allocation: 50,
    capacityDays: 5,
    workload: 80,
    status: "active",
  },
  {
    id: "risya",
    name: "Risya",
    email: "risya@wit.id",
    role: "SA",
    roleLabel: "System Analyst",
    skillTags: ["Documentation", "Data"],
    allocation: 50,
    capacityDays: 5,
    workload: 70,
    status: "active",
  },
  {
    id: "reyza",
    name: "Reyza",
    email: "reyza@wit.id",
    role: "Fullstack",
    roleLabel: "Fullstack Developer",
    skillTags: ["FE", "BE"],
    allocation: 100,
    capacityDays: 10,
    workload: 90,
    status: "active",
  },
  {
    id: "aditiya",
    name: "Aditiya",
    email: "aditiya@wit.id",
    role: "Backend",
    roleLabel: "Backend Developer",
    skillTags: ["BE", "Infra"],
    allocation: 50,
    capacityDays: 5,
    workload: 110,
    status: "active",
  },
  {
    id: "christian",
    name: "Christian",
    email: "christian@wit.id",
    role: "QA",
    roleLabel: "QA Engineer",
    skillTags: ["QA"],
    allocation: 75,
    capacityDays: 7.5,
    workload: 80,
    status: "active",
  },
  {
    id: "vinza",
    name: "Vinza",
    email: "vinza@wit.id",
    role: "Writer",
    roleLabel: "Technical Writer",
    skillTags: ["Documentation"],
    allocation: 25,
    capacityDays: 2.5,
    workload: 40,
    status: "active",
  },
];

const oeeInsight: AIInsight = {
  insight:
    "The module is progressing, but data readiness is the main risk.",
  reason:
    "Three of the last four blockers were caused by missing or unvalidated machine data from the client.",
  recommendations: [
    "Complete data validation before adding new dashboard features",
    "Add a Data Readiness Gate to sprint planning",
    "Escalate sample data request to client PIC",
  ],
  confidence: "high",
};

export const products: Product[] = [
  {
    id: "oee-intelligence",
    projectId: "ubs-mdt",
    clientId: "ubs-gold",
    name: "OEE Intelligence Platform",
    goal: "Give plant managers real-time OEE visibility across pilot machines.",
    owner: "Client PIC (Pak Hendra)",
    deliveryLead: "Fahmi",
    status: "development",
    health: 78,
    risk: "medium",
    velocity: 33,
    blockedCount: 3,
    currentSprintId: "sprint-03",
    modules: [
      { id: "mda", name: "Machine Data Acquisition", owner: "Aditiya", status: "in-progress" },
      { id: "oee-dash", name: "OEE Dashboard", owner: "Reyza", status: "in-progress" },
      { id: "downtime", name: "Downtime Analysis", owner: "Risya", status: "planned" },
      { id: "report-export", name: "Report & Export", owner: "Vinza", status: "planned" },
      { id: "alerts", name: "Alert & Notification", owner: "Reyza", status: "planned" },
    ],
    aiInsight: oeeInsight,
  },
  {
    id: "scada-monitoring",
    projectId: "ubs-mdt",
    clientId: "ubs-gold",
    name: "SCADA Monitoring",
    goal: "Unified SCADA visibility for plant operations.",
    owner: "Client PIC",
    deliveryLead: "Fahmi",
    status: "development",
    health: 88,
    risk: "low",
    velocity: 30,
    blockedCount: 0,
    currentSprintId: undefined,
    modules: [
      { id: "scada-conn", name: "PLC Connectivity", owner: "Aditiya", status: "in-progress" },
      { id: "scada-viz", name: "Realtime Visualization", owner: "Reyza", status: "in-progress" },
    ],
    aiInsight: {
      insight: "Sprint 05 is on track.",
      reason: "Burndown matches ideal line and no open blockers.",
      recommendations: ["Keep commitment at current velocity"],
      confidence: "high",
    },
  },
  {
    id: "ai-qc-camera",
    projectId: "ubs-mdt",
    clientId: "ubs-gold",
    name: "AI QC Camera",
    goal: "Automated visual quality inspection on line 2.",
    owner: "Client PIC",
    deliveryLead: "Fahmi",
    status: "development",
    health: 55,
    risk: "high",
    velocity: 18,
    blockedCount: 2,
    currentSprintId: undefined,
    modules: [
      { id: "qc-capture", name: "Image Capture", owner: "Aditiya", status: "in-progress" },
      { id: "qc-model", name: "Defect Model", owner: "Reyza", status: "planned" },
    ],
    aiInsight: {
      insight: "Sprint 02 is blocked on camera installation access.",
      reason: "Two core tasks have been blocked for 4 days awaiting site access.",
      recommendations: ["Escalate site access to client operations lead"],
      confidence: "high",
    },
  },
  {
    id: "cmms-integration",
    projectId: "ubs-mdt",
    clientId: "ubs-gold",
    name: "CMMS Integration",
    goal: "Connect maintenance orders with machine downtime data.",
    owner: "Client PIC",
    deliveryLead: "Fahmi",
    status: "discovery",
    health: 40,
    risk: "high",
    velocity: 0,
    blockedCount: 1,
    currentSprintId: undefined,
    modules: [{ id: "cmms-scope", name: "Integration Scoping", owner: "Risya", status: "in-progress" }],
    aiInsight: {
      insight: "Discovery is stalled on unclear CMMS vendor API access.",
      reason: "Vendor has not responded to the API documentation request.",
      recommendations: ["Ask client to open vendor communication channel"],
      confidence: "medium",
    },
  },
  {
    id: "ai-knowledge-bank",
    projectId: "ubs-mdt",
    clientId: "ubs-gold",
    name: "AI Knowledge Bank",
    goal: "Searchable knowledge base for plant SOPs.",
    owner: "Client PIC",
    deliveryLead: "Fahmi",
    status: "development",
    health: 90,
    risk: "low",
    velocity: 22,
    blockedCount: 0,
    currentSprintId: undefined,
    modules: [
      { id: "kb-ingest", name: "Document Ingestion", owner: "Aditiya", status: "in-progress" },
      { id: "kb-search", name: "AI Search", owner: "Reyza", status: "planned" },
    ],
    aiInsight: {
      insight: "Sprint 01 is healthy.",
      reason: "All committed items are on track and DoD compliance is 100%.",
      recommendations: ["No action needed"],
      confidence: "high",
    },
  },
  {
    id: "bsm-rental-platform",
    projectId: "bsm-rental",
    clientId: "bsm",
    name: "Rental Management Platform",
    goal: "Run rental, service, and invoicing in one system.",
    owner: "Ibu Sari",
    deliveryLead: "Fahmi",
    status: "development",
    health: 85,
    risk: "low",
    velocity: 28,
    blockedCount: 0,
    currentSprintId: undefined,
    modules: [
      { id: "inventory", name: "Inventory", owner: "Reyza", status: "done" },
      { id: "peminjaman", name: "Rental", owner: "Reyza", status: "in-progress" },
      { id: "service", name: "Service", owner: "Aditiya", status: "planned" },
      { id: "finance", name: "Finance", owner: "Aditiya", status: "planned" },
      { id: "invoice", name: "Invoice", owner: "Reyza", status: "planned" },
      { id: "reporting", name: "Reporting", owner: "Vinza", status: "planned" },
    ],
    aiInsight: {
      insight: "Sprint 04 report is ready for review.",
      reason: "All report data sources are complete.",
      recommendations: ["Review and send the module report to BSM"],
      confidence: "high",
    },
  },
  {
    id: "bni-knowledge-platform",
    projectId: "bni-knowledge",
    clientId: "bni",
    name: "Knowledge Platform",
    goal: "Centralized internal knowledge with AI-assisted search.",
    owner: "Pak Dimas",
    deliveryLead: "Fahmi",
    status: "development",
    health: 92,
    risk: "low",
    velocity: 25,
    blockedCount: 0,
    currentSprintId: undefined,
    modules: [
      { id: "bni-portal", name: "Portal", owner: "Reyza", status: "in-progress" },
      { id: "bni-search", name: "Search", owner: "Aditiya", status: "planned" },
    ],
    aiInsight: {
      insight: "Sprint 02 is healthy and ahead of the ideal burndown.",
      reason: "Completed work is 10% ahead of plan.",
      recommendations: ["Consider pulling one ready backlog item forward"],
      confidence: "medium",
    },
  },
];

export const sprints: Sprint[] = [
  {
    id: "sprint-03",
    productId: "oee-intelligence",
    moduleId: "mda",
    number: 3,
    name: "Machine Data Validation",
    goal: "Validate OEE data source from selected pilot machines.",
    startDate: "2026-06-29",
    endDate: "2026-07-10",
    workingDays: 10,
    daysLeft: 4,
    status: "active",
    members: [
      { memberId: "reyza", allocation: 100, capacityDays: 10 },
      { memberId: "aditiya", allocation: 50, capacityDays: 5 },
      { memberId: "christian", allocation: 75, capacityDays: 7.5 },
      { memberId: "risya", allocation: 50, capacityDays: 5 },
    ],
    backlogItemIds: ["b1", "b2", "b3", "b6"],
    committed: 42,
    completed: 24,
    progress: 62,
    risk: "medium",
  },
  {
    id: "sprint-02",
    productId: "oee-intelligence",
    moduleId: "oee-dash",
    number: 2,
    name: "OEE Dashboard Foundation",
    goal: "Ship the first OEE dashboard with static data.",
    startDate: "2026-06-15",
    endDate: "2026-06-26",
    workingDays: 10,
    daysLeft: 0,
    status: "done",
    members: [
      { memberId: "reyza", allocation: 100, capacityDays: 10 },
      { memberId: "aditiya", allocation: 50, capacityDays: 5 },
      { memberId: "christian", allocation: 75, capacityDays: 7.5 },
    ],
    backlogItemIds: [],
    committed: 42,
    completed: 38,
    progress: 100,
    risk: "low",
  },
  {
    id: "sprint-01",
    productId: "oee-intelligence",
    moduleId: "mda",
    number: 1,
    name: "Data Acquisition Setup",
    goal: "Connect the first pilot machine to the platform.",
    startDate: "2026-06-01",
    endDate: "2026-06-12",
    workingDays: 10,
    daysLeft: 0,
    status: "done",
    members: [
      { memberId: "reyza", allocation: 100, capacityDays: 10 },
      { memberId: "aditiya", allocation: 50, capacityDays: 5 },
    ],
    backlogItemIds: [],
    committed: 40,
    completed: 32,
    progress: 100,
    risk: "low",
  },
];

export const tasks: Task[] = [
  {
    id: "t1",
    sprintId: "sprint-03",
    backlogItemId: "b1",
    title: "Create API mapping for machine telemetry",
    moduleName: "Machine Data Acquisition",
    assigneeId: "aditiya",
    estimate: 3,
    column: "blocked",
    priority: "high",
    dod: [
      { label: "Mapping documented", done: true },
      { label: "Endpoints validated", done: false },
      { label: "Reviewed by SA", done: false },
    ],
    blockedReason: "Waiting sample machine data from client",
    blockedDays: 3,
  },
  {
    id: "t2",
    sprintId: "sprint-03",
    backlogItemId: "b2",
    title: "Build OEE dashboard UI",
    moduleName: "OEE Dashboard",
    assigneeId: "reyza",
    estimate: 5,
    column: "in-progress",
    priority: "high",
    dod: [
      { label: "Matches approved design", done: true },
      { label: "Responsive layout", done: true },
      { label: "Connected to data preview", done: false },
      { label: "Code reviewed", done: false },
      { label: "QA passed", done: false },
    ],
  },
  {
    id: "t3",
    sprintId: "sprint-03",
    backlogItemId: "b1",
    title: "Create test scenario for data validation",
    moduleName: "Machine Data Acquisition",
    assigneeId: "christian",
    estimate: 2,
    column: "in-review",
    priority: "medium",
    dod: [
      { label: "Scenarios cover all machine types", done: true },
      { label: "Reviewed by SA", done: true },
    ],
  },
  {
    id: "t4",
    sprintId: "sprint-03",
    backlogItemId: "b3",
    title: "Confirm downtime category requirement",
    moduleName: "Downtime Analysis",
    assigneeId: "risya",
    estimate: 1,
    column: "blocked",
    priority: "high",
    dod: [
      { label: "Categories confirmed by client", done: false },
      { label: "Documented in requirement", done: false },
    ],
    blockedReason: "Waiting client PIC confirmation",
    blockedDays: 2,
  },
  {
    id: "t5",
    sprintId: "sprint-03",
    backlogItemId: "b1",
    title: "Validate telemetry API response",
    moduleName: "Machine Data Acquisition",
    assigneeId: "aditiya",
    estimate: 3,
    column: "ready",
    priority: "high",
    dod: [
      { label: "Response schema validated", done: false },
      { label: "Error cases handled", done: false },
    ],
  },
  {
    id: "t6",
    sprintId: "sprint-03",
    backlogItemId: "b2",
    title: "Machine data preview table",
    moduleName: "OEE Dashboard",
    assigneeId: "reyza",
    estimate: 3,
    column: "done",
    priority: "medium",
    dod: [
      { label: "Preview renders live data", done: true },
      { label: "Code reviewed", done: true },
      { label: "QA passed", done: true },
    ],
  },
  {
    id: "t7",
    sprintId: "sprint-03",
    backlogItemId: "b1",
    title: "QA validation of data acquisition flow",
    moduleName: "Machine Data Acquisition",
    assigneeId: "christian",
    estimate: 2,
    column: "qa",
    priority: "high",
    dod: [
      { label: "All scenarios executed", done: true },
      { label: "Bugs logged", done: false },
    ],
  },
  {
    id: "t8",
    sprintId: "sprint-03",
    backlogItemId: "b6",
    title: "Draft alert threshold config screen",
    moduleName: "Alert & Notification",
    assigneeId: "reyza",
    estimate: 2,
    column: "selected",
    priority: "low",
    dod: [
      { label: "Design approved", done: false },
      { label: "Code reviewed", done: false },
    ],
    offGoal: true,
  },
  {
    id: "t9",
    sprintId: "sprint-03",
    backlogItemId: "b2",
    title: "Document OEE formula assumptions",
    moduleName: "OEE Dashboard",
    assigneeId: "risya",
    estimate: 1,
    column: "done",
    priority: "medium",
    dod: [
      { label: "Formula documented", done: true },
      { label: "Shared with client", done: true },
    ],
  },
];

export const backlog: BacklogItem[] = [
  {
    id: "b1",
    productId: "oee-intelligence",
    moduleId: "mda",
    title: "Machine telemetry ingestion",
    story:
      "As a plant engineer, I want machine telemetry ingested every minute, so that OEE is calculated from live data.",
    acceptanceCriteria: [
      "Telemetry is pulled every 60 seconds",
      "Failed pulls are retried and logged",
      "Data is stored with machine ID and timestamp",
    ],
    type: "story",
    priority: "high",
    readiness: "ready",
    estimate: 8,
    aiSuggestions: [],
  },
  {
    id: "b2",
    productId: "oee-intelligence",
    moduleId: "oee-dash",
    title: "Real-time OEE dashboard",
    story:
      "As a plant manager, I want a real-time OEE dashboard, so that I can monitor availability, performance, and quality at a glance.",
    acceptanceCriteria: [
      "Shows OEE, availability, performance, quality per machine",
      "Updates without page refresh",
      "Highlights machines below OEE threshold",
    ],
    type: "story",
    priority: "high",
    readiness: "ready",
    estimate: 10,
    aiSuggestions: [
      "Story is large (10 pts). Recommended split: per-machine view and plant overview.",
    ],
  },
  {
    id: "b3",
    productId: "oee-intelligence",
    moduleId: "downtime",
    title: "Downtime categorization",
    story:
      "As a supervisor, I want downtime events categorized, so that I can analyze the biggest loss contributors.",
    acceptanceCriteria: [],
    type: "story",
    priority: "high",
    readiness: "needs-clarification",
    estimate: 5,
    aiSuggestions: [
      "Acceptance criteria missing.",
      "Dependency unclear: downtime categories not yet confirmed by client.",
      "This item needs clearer acceptance criteria before sprint planning.",
    ],
  },
  {
    id: "b4",
    productId: "oee-intelligence",
    moduleId: "report-export",
    title: "Export OEE report",
    story:
      "As a plant manager, I want to export OEE reports, so that I can share performance with management.",
    acceptanceCriteria: ["Export to PDF and XLSX", "Includes selected date range"],
    type: "story",
    priority: "medium",
    readiness: "ready",
    estimate: 6,
    aiSuggestions: [],
  },
  {
    id: "b5",
    productId: "oee-intelligence",
    moduleId: "alerts",
    title: "Add approval feature",
    story: "Tambah fitur approval.",
    acceptanceCriteria: [],
    type: "story",
    priority: "low",
    readiness: "draft",
    estimate: 0,
    aiSuggestions: [
      "Story is too vague. Suggested rewrite: As a requester, I want to submit approval requests, so that my request can be reviewed by an authorized approver.",
      "Suggested acceptance criteria: user can create approval request; approver receives notification; approver can approve or reject; system stores approval history.",
      "Recommended split into 3 smaller items: request submission, approval flow, approval history.",
    ],
  },
  {
    id: "b6",
    productId: "oee-intelligence",
    moduleId: "alerts",
    title: "Downtime alert notification",
    story:
      "As a supervisor, I want an alert when a machine is down for more than 10 minutes, so that I can respond quickly.",
    acceptanceCriteria: [
      "Alert triggers after configurable threshold",
      "Notification sent to assigned supervisor",
    ],
    type: "story",
    priority: "medium",
    readiness: "needs-clarification",
    estimate: 5,
    aiSuggestions: ["Duplicate check: similar to 'Add approval feature'? No — distinct scope."],
  },
];

export const dailyUpdates: DailyUpdate[] = [
  {
    memberId: "reyza",
    yesterday: "Dashboard UI",
    today: "Data preview",
    blocker: null,
    confidence: "high",
  },
  {
    memberId: "aditiya",
    yesterday: "API mapping",
    today: "API validation",
    blocker: "Waiting sample data",
    confidence: "medium",
  },
  {
    memberId: "christian",
    yesterday: "Test scenario",
    today: "QA validation",
    blocker: null,
    confidence: "high",
  },
  {
    memberId: "risya",
    yesterday: "Requirement",
    today: "Client confirm",
    blocker: "Waiting client PIC",
    confidence: "low",
  },
];

export const burndown: BurndownPoint[] = [
  { day: 1, ideal: 100, actual: 100 },
  { day: 2, ideal: 90, actual: 96 },
  { day: 3, ideal: 80, actual: 88 },
  { day: 4, ideal: 70, actual: 84 },
  { day: 5, ideal: 60, actual: 72 },
  { day: 6, ideal: 50, actual: 60 },
  { day: 7, ideal: 40, actual: null },
  { day: 8, ideal: 30, actual: null },
  { day: 9, ideal: 20, actual: null },
  { day: 10, ideal: 0, actual: null },
];

// Cumulative flow (points per state per day) — consistent with the burndown:
// done + inProgress + todo = 42 committed points, remaining = inProgress + todo.
export const cfd = [
  { day: 1, done: 0, inProgress: 6, todo: 36 },
  { day: 2, done: 2, inProgress: 8, todo: 32 },
  { day: 3, done: 5, inProgress: 10, todo: 27 },
  { day: 4, done: 7, inProgress: 12, todo: 23 },
  { day: 5, done: 12, inProgress: 12, todo: 18 },
  { day: 6, done: 17, inProgress: 13, todo: 12 },
];

export const velocity: VelocityEntry[] = [
  { sprint: "Sprint 01", committed: 40, completed: 32 },
  { sprint: "Sprint 02", committed: 42, completed: 38 },
  { sprint: "Sprint 03", committed: 45, completed: 35 },
  { sprint: "Sprint 04", committed: 40, completed: 40 },
];

export const decisions: Decision[] = [
  {
    id: "d1",
    date: "2026-07-01",
    title: "Pilot machines limited to Line 1",
    detail:
      "Sprint 03 validation covers only Line 1 machines. Line 2 is deferred to Sprint 04.",
    owner: "Fahmi",
    status: "decided",
  },
  {
    id: "d2",
    date: "2026-07-03",
    title: "OEE formula validation",
    detail: "Client to validate the OEE formula against their manual calculation.",
    owner: "Pak Hendra",
    status: "open",
  },
  {
    id: "d3",
    date: "2026-07-05",
    title: "Downtime category ownership",
    detail: "Client must assign an owner for downtime category definitions.",
    owner: "Pak Hendra",
    status: "open",
  },
];

export const homeInsight: AIInsight = {
  insight:
    "Most current risks are caused by unclear client-side data readiness.",
  reason:
    "4 of 6 open blockers across the portfolio are waiting on client data or confirmation.",
  recommendations: [
    "Add a Data Readiness Gate to sprint planning",
    "Escalate the OEE sample data request to UBS Gold PIC",
  ],
  confidence: "high",
};

export const dailyInsight: AIInsight = {
  insight: "Core data validation is blocked by missing sample data.",
  reason:
    "3 core backlog items have not moved for 2 days and 1 blocker has been open for more than 48 hours.",
  recommendations: [
    "Escalate sample data request to client PIC today",
    "Focus today's work on Sprint Goal critical items",
  ],
  confidence: "high",
};

export const burndownInsight: AIInsight = {
  insight: "Actual burndown is behind the ideal line since Day 4.",
  reason: "Main cause: blocked telemetry API task (3 tasks blocked more than 2 days).",
  recommendations: [
    "Reduce low-priority scope",
    "Assign support to blocker resolution",
  ],
  confidence: "high",
};

export const velocityInsight: AIInsight = {
  insight: "Average velocity from the last 4 sprints is 36.25 points.",
  reason: "Velocity has ranged between 32 and 40 with a stable team.",
  recommendations: [
    "Plan next sprint between 32–38 points",
    "Avoid committing more than 40 points unless capacity increases",
  ],
  confidence: "high",
};

// Sprint Review mock data (spec §10.9)
export const reviewData = {
  demoChecklist: [
    { label: "Machine data preview table with live telemetry", done: true },
    { label: "OEE formula documentation walkthrough", done: true },
    { label: "Dashboard UI (work in progress preview)", done: false },
  ],
  clientFeedback: [
    {
      from: "Pak Hendra",
      note: "Preview table is exactly what operators need. Add shift filter.",
      disposition: "Added to backlog",
    },
    {
      from: "Plant supervisor",
      note: "OEE formula matches our manual calculation for Line 1.",
      disposition: "Validated",
    },
  ],
  aiSummary: {
    insight:
      "Review produced 1 new backlog item and validated the OEE formula.",
    reason:
      "Client accepted 2 of 3 demo items; the dashboard preview needs live data to be accepted.",
    recommendations: [
      "Prioritize the shift filter request in backlog refinement",
      "Re-demo the dashboard once telemetry validation completes",
    ],
    confidence: "high" as const,
  },
};

// Sprint Retrospective mock data (spec §10.10)
export const retroData = {
  wentWell: [
    "QA scenarios were ready before development finished",
    "Daily updates were consistent across the whole team",
    "Formula documentation unblocked client validation early",
  ],
  needsImprovement: [
    "Client data dependency blocked core work for 3 days",
    "Backend capacity was overcommitted from day one",
    "Requirement confirmation loops took more than 48 hours",
  ],
  actions: [
    {
      action: "Add client confirmation checklist into Definition of Ready",
      owner: "Risya",
      due: "2026-07-14",
      status: "open" as const,
    },
    {
      action: "Introduce Data Readiness Gate in sprint planning",
      owner: "Fahmi",
      due: "2026-07-13",
      status: "open" as const,
    },
    {
      action: "Rebalance backend allocation for Sprint 04",
      owner: "Fahmi",
      due: "2026-07-11",
      status: "done" as const,
    },
  ],
  rootCause: {
    insight: "Requirement blocker appeared in 3 consecutive sprints.",
    reason:
      "Backlog items enter sprints before client-side inputs (data, confirmations) are secured.",
    recommendations: [
      "Add client confirmation checklist into Definition of Ready",
      "Track client dependencies as first-class blockers with owners",
    ],
    confidence: "high" as const,
  },
  memory:
    "Recurring pattern: client data readiness has been the top blocker in Sprints 01, 02, and 03.",
};

// Report-only mock data (spec §17 template focuses)
export const reportExtras = {
  demoItems: [
    { title: "Machine data preview table", result: "Accepted by client" },
    { title: "OEE formula documentation", result: "Validated against manual calculation" },
  ],
  qaSummary: {
    passed: 4,
    reopened: 1,
    pendingVerification: 2,
    reopenReason: "Telemetry edge case: null machine ID on reconnect",
  },
  deployment: {
    environment: "Staging",
    lastDeploy: "2026-07-04",
    status: "Stable",
    note: "Production deploy planned after data validation completes.",
  },
  techDebt: [
    "Telemetry polling lacks retry backoff — quick fix applied, needs proper queue",
    "Dashboard components share no chart primitives yet",
  ],
  timelineRisk:
    "Sprint 04 scope depends on client sample data. A delay past July 10 shifts the pilot release by one sprint.",
  deliveryConfidence: {
    level: "Medium",
    reason:
      "Team velocity is stable, but 2 of 4 sprint backlog items depend on client-side data readiness.",
  },
  nextSprintPlan: [
    "Complete telemetry validation on remaining Line 1 machines",
    "Start downtime categorization once categories are confirmed",
    "Prepare pilot demo for plant manager review",
  ],
};

export const reportQueueSeed = [
  {
    id: "rq1",
    title: "OEE Intelligence — Sprint 03 Report",
    productId: "oee-intelligence",
    client: "UBS Gold",
    type: "Sprint Report",
    template: "Client Facing",
    due: "2026-07-10",
    status: "open" as const,
  },
  {
    id: "rq2",
    title: "BSM Rental — Module Report",
    productId: "bsm-rental-platform",
    client: "BSM",
    type: "Module Report",
    template: "Client Facing",
    due: "2026-07-08",
    status: "open" as const,
  },
  {
    id: "rq3",
    title: "UBS Gold — Monthly Client Report",
    productId: "oee-intelligence",
    client: "UBS Gold",
    type: "Client Report",
    template: "Management",
    due: "2026-07-31",
    status: "planned" as const,
  },
  {
    id: "rq4",
    title: "OEE Intelligence — Sprint 02 Report",
    productId: "oee-intelligence",
    client: "UBS Gold",
    type: "Sprint Report",
    template: "Internal PM",
    due: "2026-06-27",
    status: "done" as const,
  },
];

export const todaysPriorities = [
  "Resolve blocker in OEE Intelligence Sprint 03",
  "Review BSM Rental Module Report",
  "Confirm scope change for AI QC Camera",
];

// ---------- lookups ----------

export const getClient = (id: string) => clients.find((c) => c.id === id);
export const getProject = (id: string) => projects.find((p) => p.id === id);
export const getProduct = (id: string) => products.find((p) => p.id === id);
export const getMember = (id: string) => members.find((m) => m.id === id);
export const tasksOfSprint = (sprintId: string) =>
  tasks.filter((t) => t.sprintId === sprintId);
export const sprintBacklogItems = (sprint: Sprint) =>
  sprint.backlogItemIds
    .map((id) => backlog.find((b) => b.id === id))
    .filter((b): b is BacklogItem => !!b);

// ---------- hierarchy path builders ----------
// Single source of truth for drill-down URLs so pages never hand-assemble them.

export const clientPath = (clientId: string) => `/clients/${clientId}`;

export const projectPath = (project: Project) =>
  `${clientPath(project.clientId)}/projects/${project.id}`;

export const productPath = (product: Product) =>
  `${clientPath(product.clientId)}/projects/${product.projectId}/products/${product.id}`;

export const productPathById = (productId: string) => {
  const product = getProduct(productId);
  return product ? productPath(product) : "/clients";
};

export const modulePath = (product: Product, moduleId: string) =>
  `${productPath(product)}/modules/${moduleId}`;

export const sprintPath = (sprint: Sprint) =>
  `${productPathById(sprint.productId)}/sprints/${sprint.id}`;
