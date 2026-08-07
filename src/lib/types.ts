export type Health = "healthy" | "warning" | "at-risk";
export type Risk = "low" | "medium" | "high";

export interface Client {
  id: string;
  name: string;
  industry: string;
  status: "active" | "inactive" | "prospect";
  clientPic: string;
  witOwner: string;
  contractType: string;
  health: Health;
  risk: Risk;
  notes: string;
  actionNeeded: string[];
  aiInsight: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  status: "discovery" | "active" | "done" | "on-hold";
}

export interface Product {
  id: string;
  projectId: string;
  clientId: string;
  name: string;
  goal: string;
  owner: string;
  deliveryLead: string;
  status: "discovery" | "development" | "release" | "maintenance";
  health: number; // 0-100
  risk: Risk;
  velocity: number;
  blockedCount: number;
  modules: Module[];
  currentSprintId?: string;
  aiInsight: AIInsight;
}

export interface Module {
  id: string;
  name: string;
  owner: string;
  status: "planned" | "in-progress" | "done";
}

// Common values are seeded in the masters; custom values are allowed.
export type MemberRole = string;

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  roleLabel: string;
  skillTags: string[];
  allocation: number; // % involvement in product
  capacityDays: number; // per sprint
  workload: number; // % of capacity currently assigned
  status: "active" | "inactive" | "temporary";
}

// Seeded as high | medium | low; the priorities master may add custom values.
export type Priority = string;
export type Readiness = "ready" | "needs-clarification" | "draft";

export interface BacklogItem {
  id: string;
  productId: string;
  moduleId: string;
  title: string;
  story: string;
  acceptanceCriteria: string[];
  type: string; // from the work item types master
  priority: Priority;
  readiness: Readiness;
  estimate: number; // mandays or points
  aiSuggestions: string[];
}

export type BoardColumn =
  | "selected"
  | "ready"
  | "in-progress"
  | "in-review"
  | "qa"
  | "done"
  | "blocked";

export interface DodItem {
  label: string;
  done: boolean;
}

/** One reason a task cannot move, and who it is waiting on. */
export interface Blocker {
  id: string;
  /** From the blockerCategories master list, so a team can add its own. */
  category: string;
  text: string;
  /** How long it has been standing. */
  days?: number;
}

export interface Task {
  id: string;
  sprintId: string;
  /**
   * The day this is meant to be finished, inside its sprint's dates. A board
   * column says where work is, not when it is due, so the calendar had nothing
   * to place a task on until this existed.
   */
  dueDate: string;
  backlogItemId: string;
  title: string;
  moduleName: string;
  assigneeId: string;
  estimate: number;
  column: BoardColumn;
  priority: Priority;
  dod: DodItem[];
  /**
   * Everything standing in this task's way. A task is rarely stopped by one
   * thing, and the count is the signal the board colours by — one blocker is a
   * note, three is an escalation.
   */
  blockers: Blocker[];
  offGoal?: boolean;
}

export interface SprintMember {
  memberId: string;
  allocation: number; // % in this sprint
  capacityDays: number;
}

export interface Sprint {
  id: string;
  productId: string;
  moduleId: string; // the Component (product.modules[]) that owns this sprint
  number: number;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  daysLeft: number;
  status: "planning" | "active" | "review" | "done";
  members: SprintMember[];
  backlogItemIds: string[];
  committed: number;
  completed: number;
  progress: number; // % to sprint goal
  risk: Risk;
}

export interface DailyUpdate {
  memberId: string;
  yesterday: string;
  today: string;
  blocker: string | null;
  confidence: "high" | "medium" | "low";
}

export interface BurndownPoint {
  day: number;
  ideal: number;
  actual: number | null;
}

export interface VelocityEntry {
  sprint: string;
  committed: number;
  completed: number;
}

export interface Decision {
  id: string;
  productId: string; // the Module this decision belongs to
  date: string;
  title: string;
  detail: string;
  owner: string;
  status: "open" | "decided";
}

export interface AIInsight {
  insight: string;
  reason: string;
  recommendations: string[];
  confidence: "high" | "medium" | "low";
}

export type ReportType =
  | "Sprint Report"
  | "Module Report"
  | "Client Report"
  | "Member Performance Report"
  | "Risk Report";

// Template names come from the Report Template Master (custom values allowed).
export type ReportTemplate = string;

export interface ReportConfig {
  type: ReportType;
  template: ReportTemplate;
  period: string;
}

export interface GeneratedReport {
  id: string;
  productId: string;
  config: ReportConfig;
  date: string;
  status: "draft" | "sent";
}

export interface QueuedReport {
  id: string;
  title: string;
  productId: string;
  client: string;
  type: string;
  template: string;
  due: string;
  status: "open" | "planned" | "done";
}
