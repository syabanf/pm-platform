import type { components } from "./schema";
import type {
  AIInsight,
  BacklogItem,
  Client,
  ClientFeedback,
  Decision,
  DemoItem,
  GeneratedReport,
  Member,
  Module,
  Project,
  QueuedReport,
  RetroAction,
  RetroNote,
  Sprint,
  Task,
} from "../types";
import {
  masterLists,
  workspaceDefaults,
  type MasterListKey,
  type ReportTemplateDef,
  type RoleDef,
} from "../data";
import { api } from "./client";

/**
 * The backend snapshot, in the store's own types.
 *
 * The API speaks its own dialect: DATE columns come back as RFC 3339 midnight,
 * a task's column is `boardColumn`, a decision's date is `decidedOn`, and
 * nullable foreign keys are null where the store keeps "". Every difference
 * is settled here, once, so the pages never see it.
 */
export interface WorkspaceData {
  clients: Client[];
  projects: Project[];
  modules: Module[];
  members: Member[];
  backlog: BacklogItem[];
  sprints: Sprint[];
  tasks: Task[];
  decisions: Decision[];
  retroNotes: RetroNote[];
  retroActions: RetroAction[];
  demoItems: DemoItem[];
  clientFeedback: ClientFeedback[];
  roles: RoleDef[];
  reportTemplates: ReportTemplateDef[];
  reportQueue: QueuedReport[];
  generatedReports: GeneratedReport[];
  masters: Record<MasterListKey, string[]>;
  workspaceConf: typeof workspaceDefaults;
  dodTemplate: string[];
}

type S = components["schemas"];

/** "2026-01-12T00:00:00Z" → "2026-01-12"; null → "". */
const dateOnly = (v: string | null | undefined) =>
  (v ?? "").slice(0, 10);

const emptyInsight: AIInsight = {
  insight: "",
  reason: "",
  recommendations: [],
  confidence: "medium",
};

/** The message the API gave, or a fallback, as an Error a caller can show. */
export function apiError(error: unknown, fallback: string): Error {
  const msg =
    error && typeof error === "object" && "error" in error
      ? String((error as { error: unknown }).error)
      : fallback;
  return new Error(msg);
}

const toClient = (c: S["Client"]): Client => ({
  id: c.id ?? "",
  name: c.name ?? "",
  industry: c.industry ?? "",
  status: (c.status ?? "active") as Client["status"],
  clientPic: c.clientPic ?? "",
  witOwner: c.witOwner ?? "",
  contractType: c.contractType ?? "",
  health: (c.health ?? "healthy") as Client["health"],
  risk: (c.risk ?? "low") as Client["risk"],
  notes: c.notes ?? "",
  actionNeeded: c.actionNeeded ?? [],
  aiInsight: typeof c.aiInsight === "string" ? c.aiInsight : "",
});

const toProject = (p: S["Project"]): Project => ({
  id: p.id ?? "",
  clientId: p.clientId ?? "",
  name: p.name ?? "",
  objective: p.objective ?? "",
  startDate: dateOnly(p.startDate),
  status: (p.status ?? "discovery") as Project["status"],
});

type ModuleRow = S["Workspace"]["modules"][number];

const toModule = (m: ModuleRow): Module => {
  const insight = m.aiInsight;
  return {
    id: m.id ?? "",
    projectId: m.projectId ?? "",
    clientId: m.clientId ?? "",
    name: m.name ?? "",
    goal: m.goal ?? "",
    owner: m.owner ?? "",
    deliveryLead: m.deliveryLead ?? "",
    status: (m.status ?? "discovery") as Module["status"],
    health: m.health ?? 100,
    risk: (m.risk ?? "low") as Module["risk"],
    velocity: m.velocity ?? 0,
    blockedCount: m.blockedCount ?? 0,
    components: m.components.map((c) => ({
      id: c.id ?? "",
      name: c.name ?? "",
      owner: c.owner ?? "",
      status: (c.status ?? "planned") as Module["components"][number]["status"],
    })),
    currentSprintId: m.currentSprintId ?? undefined,
    aiInsight:
      insight && typeof insight === "object"
        ? { ...emptyInsight, ...(insight as Partial<AIInsight>) }
        : emptyInsight,
  };
};

const toMember = (m: S["Member"]): Member => ({
  id: m.id ?? "",
  name: m.name ?? "",
  email: m.email ?? "",
  role: m.role ?? "",
  roleLabel: m.roleLabel ?? "",
  skillTags: m.skillTags ?? [],
  allocation: m.allocation ?? 100,
  capacityDays: m.capacityDays ?? 0,
  workload: m.workload ?? 0,
  status: (m.status ?? "active") as Member["status"],
});

const toBacklogItem = (b: S["BacklogItem"]): BacklogItem => ({
  id: b.id ?? "",
  moduleId: b.moduleId ?? "",
  componentId: b.componentId ?? "",
  title: b.title ?? "",
  story: b.story ?? "",
  acceptanceCriteria: b.acceptanceCriteria ?? [],
  type: b.type ?? "story",
  priority: b.priority ?? "medium",
  readiness: (b.readiness ?? "draft") as BacklogItem["readiness"],
  estimate: b.estimate ?? 0,
  aiSuggestions: b.aiSuggestions ?? [],
});

type SprintRow = S["Workspace"]["sprints"][number];

const toSprint = (s: SprintRow): Sprint => ({
  id: s.id ?? "",
  moduleId: s.moduleId ?? "",
  componentId: s.componentId ?? "",
  number: s.number ?? 0,
  name: s.name ?? "",
  goal: s.goal ?? "",
  startDate: dateOnly(s.startDate),
  endDate: dateOnly(s.endDate),
  workingDays: s.workingDays ?? 10,
  daysLeft: s.daysLeft ?? 10,
  status: (s.status ?? "planning") as Sprint["status"],
  members: s.members.map((m) => ({
    memberId: m.memberId ?? "",
    allocation: m.allocation ?? 100,
    capacityDays: m.capacityDays ?? 0,
  })),
  backlogItemIds: s.backlogItemIds,
  committed: s.committed ?? 0,
  completed: s.completed ?? 0,
  progress: s.progress ?? 0,
  risk: (s.risk ?? "low") as Sprint["risk"],
});

type TaskRow = S["Workspace"]["tasks"][number];

const toTask = (t: TaskRow): Task => ({
  id: t.id ?? "",
  sprintId: t.sprintId ?? "",
  dueDate: dateOnly(t.dueDate),
  backlogItemId: t.backlogItemId ?? "",
  title: t.title ?? "",
  componentName: t.componentName ?? "",
  assigneeId: t.assigneeId ?? "",
  estimate: t.estimate ?? 0,
  column: (t.boardColumn ?? "selected") as Task["column"],
  priority: t.priority ?? "medium",
  dod: t.dod.map((d) => ({ label: d.label, done: d.done })),
  blockers: (t.blockers ?? []).map((b) => ({
    id: b.id,
    category: b.category,
    text: b.text,
    days: b.days,
  })),
  offGoal: t.offGoal ?? false,
});

const toDecision = (d: S["Decision"]): Decision => ({
  id: d.id ?? "",
  moduleId: d.moduleId ?? "",
  date: dateOnly(d.decidedOn),
  title: d.title ?? "",
  detail: d.detail ?? "",
  owner: d.owner ?? "",
  status: (d.status ?? "open") as Decision["status"],
});

const toRetroNote = (n: S["RetroNote"]): RetroNote => ({
  id: n.id ?? "",
  sprintId: n.sprintId ?? "",
  kind: (n.kind ?? "went-well") as RetroNote["kind"],
  text: n.text ?? "",
});

const toRetroAction = (a: S["RetroAction"]): RetroAction => ({
  id: a.id ?? "",
  sprintId: a.sprintId ?? "",
  action: a.action ?? "",
  ownerId: a.ownerId ?? "",
  due: dateOnly(a.due),
  status: (a.status ?? "open") as RetroAction["status"],
});

const toDemoItem = (d: S["DemoItem"]): DemoItem => ({
  id: d.id ?? "",
  sprintId: d.sprintId ?? "",
  label: d.label ?? "",
  done: d.done ?? false,
});

const toClientFeedback = (f: S["ClientFeedback"]): ClientFeedback => ({
  id: f.id ?? "",
  sprintId: f.sprintId ?? "",
  from: f.fromName ?? "",
  note: f.note ?? "",
  disposition: f.disposition ?? "",
});

const toRole = (r: S["Role"]): RoleDef => ({
  id: r.id ?? "",
  name: r.label ?? "",
  permissions: Object.fromEntries(
    Object.entries((r.permissions ?? {}) as Record<string, unknown>).filter(
      (e): e is [string, boolean] => typeof e[1] === "boolean",
    ),
  ),
});

const toReportTemplate = (
  t: S["ReportTemplate"],
): ReportTemplateDef => ({
  id: t.id ?? "",
  name: t.name ?? "",
  audience: t.audience ?? "",
  frequency: t.frequency ?? "",
  visibility: (t.visibility ?? "internal") as ReportTemplateDef["visibility"],
  formats: t.formats ?? [],
  sections: (t.sections ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    enabled: s.enabled,
    body: s.body,
    autoBlock: s.autoBlock,
  })),
});

const toQueuedReport = (q: S["ReportQueueItem"]): QueuedReport => ({
  id: q.id ?? "",
  title: q.title ?? "",
  moduleId: q.moduleId ?? "",
  client: q.client ?? "",
  type: q.type ?? "",
  template: q.template ?? "",
  due: dateOnly(q.due),
  status: (q.status ?? "open") as QueuedReport["status"],
});

const toGeneratedReport = (
  r: S["GeneratedReport"],
): GeneratedReport => ({
  id: r.id ?? "",
  moduleId: r.moduleId ?? "",
  config: {
    type: (r.type ?? "Sprint Report") as GeneratedReport["config"]["type"],
    template: r.template ?? "",
    period: r.period ?? "",
  },
  date: dateOnly(r.generatedOn),
  status: (r.status ?? "draft") as GeneratedReport["status"],
});

/** Every list the store knows, filled from the API or empty. */
const toMasters = (lists: Record<string, string[]>) =>
  Object.fromEntries(
    (Object.keys(masterLists) as MasterListKey[]).map((k) => [
      k,
      lists[k] ?? [],
    ]),
  ) as Record<MasterListKey, string[]>;

/** Fetch the whole workspace, or throw with the API's reason. */
export async function loadWorkspace(): Promise<WorkspaceData> {
  const { data, error } = await api.GET("/workspace");
  if (error || !data) throw apiError(error, "could not load the workspace");
  const conf = (data.settings.settings ?? {}) as Partial<
    typeof workspaceDefaults
  >;
  return {
    clients: data.clients.map(toClient),
    projects: data.projects.map(toProject),
    modules: data.modules.map(toModule),
    members: data.members.map(toMember),
    backlog: data.backlog.map(toBacklogItem),
    sprints: data.sprints.map(toSprint),
    tasks: data.tasks.map(toTask),
    decisions: data.decisions.map(toDecision),
    retroNotes: data.retroNotes.map(toRetroNote),
    retroActions: data.retroActions.map(toRetroAction),
    demoItems: data.demoItems.map(toDemoItem),
    clientFeedback: data.clientFeedback.map(toClientFeedback),
    roles: data.roles.map(toRole),
    reportTemplates: data.reportTemplates.map(toReportTemplate),
    reportQueue: data.reportQueue.map(toQueuedReport),
    generatedReports: data.generatedReports.map(toGeneratedReport),
    masters: toMasters(data.masters),
    workspaceConf: {
      ...workspaceDefaults,
      ...conf,
      name: data.settings.name ?? workspaceDefaults.name,
    },
    dodTemplate: data.settings.dodTemplate ?? [],
  };
}
