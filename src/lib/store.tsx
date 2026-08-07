"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  BacklogItem,
  BoardColumn,
  Client,
  Decision,
  GeneratedReport,
  Member,
  Module,
  Project,
  QueuedReport,
  ReportConfig,
  Sprint,
  Task,
} from "./types";
import {
  backlog as seedBacklog,
  clients as seedClients,
  decisions as seedDecisions,
  defaultDodTemplate,
  masterLists,
  members as seedMembers,
  modules as seedModules,
  projects as seedProjects,
  reportQueueSeed,
  reportTemplateMaster,
  roleMatrix,
  sprints as seedSprints,
  tasks as seedTasks,
  workspaceDefaults,
  type MasterListKey,
  type ReportTemplateDef,
  type RoleDef,
} from "./data";

export type WorkspaceConf = typeof workspaceDefaults;
export type Masters = Record<MasterListKey, string[]>;

export interface ViewPrefs {
  board: "kanban" | "swimlanes" | "workload";
  sprints: "list" | "gantt" | "calendar";
  /** The project page's Modules section: table, or the timeline of its sprints. */
  projectModules: "list" | "gantt" | "calendar";
}

export const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

export interface Crud<T extends { id: string }> {
  add: (item: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
}

function useCollection<T extends { id: string }>(
  seed: T[]
): [T[], Crud<T>, React.Dispatch<React.SetStateAction<T[]>>] {
  const [items, setItems] = useState<T[]>(seed);
  const crud = useMemo<Crud<T>>(
    () => ({
      add: (item) => setItems((prev) => [...prev, item]),
      update: (id, patch) =>
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
        ),
      remove: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
    }),
    []
  );
  return [items, crud, setItems];
}

interface ToastState {
  id: number;
  message: string;
  tone: "info" | "warning" | "success";
}

interface PrototypeState {
  // --- mock auth (prototype, persisted in localStorage) ---
  currentUser: Member | null;
  authHydrated: boolean;
  login: (memberId: string) => void;
  logout: () => void;

  clients: Client[];
  projects: Project[];
  modules: Module[];
  members: Member[];
  backlog: BacklogItem[];
  sprints: Sprint[];
  tasks: Task[];
  decisions: Decision[];
  clientsCrud: Crud<Client>;
  projectsCrud: Crud<Project>;
  modulesCrud: Crud<Module>;
  membersCrud: Crud<Member>;
  backlogCrud: Crud<BacklogItem>;
  sprintsCrud: Crud<Sprint>;
  tasksCrud: Crud<Task>;
  decisionsCrud: Crud<Decision>;
  removeClientCascade: (clientId: string) => void;
  removeProjectCascade: (projectId: string) => void;
  removeModuleCascade: (moduleId: string) => void;
  workspaceConf: WorkspaceConf;
  setWorkspaceConf: (conf: WorkspaceConf) => void;
  roles: RoleDef[];
  togglePermission: (roleId: string, capability: string) => void;
  reportTemplates: ReportTemplateDef[];
  reportTemplatesCrud: Crud<ReportTemplateDef>;
  dodTemplate: string[];
  setDodTemplate: (items: string[]) => void;
  masters: Masters;
  addMasterValue: (key: MasterListKey, value: string) => boolean;
  renameMasterValue: (key: MasterListKey, oldValue: string, newValue: string) => void;
  removeMasterValue: (key: MasterListKey, value: string) => void;
  viewPrefs: ViewPrefs;
  setViewPref: <K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K]) => void;
  recentPaths: { path: string; label: string }[];
  recordRecentPath: (path: string, label: string) => void;
  reportQueue: QueuedReport[];
  reportQueueCrud: Crud<QueuedReport>;
  generatedReports: GeneratedReport[];
  saveGeneratedReport: (report: GeneratedReport) => void;
  markReportSent: (reportId: string) => void;
  moveTask: (taskId: string, column: BoardColumn) => boolean;
  toggleDod: (taskId: string, index: number) => void;
  toast: ToastState | null;
  showToast: (message: string, tone?: ToastState["tone"]) => void;
  aiPanelOpen: boolean;
  setAiPanelOpen: (open: boolean) => void;
  reportConfig: ReportConfig | null;
  setReportConfig: (config: ReportConfig | null) => void;
  committedSprint: {
    sprintId: string;
    goal: string;
    memberIds: string[];
    backlogIds: string[];
  } | null;
  commitSprint: (
    sprintId: string,
    data: { goal: string; memberIds: string[]; backlogIds: string[] }
  ) => void;
}

const PrototypeContext = createContext<PrototypeState | null>(null);

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const [clients, clientsCrud, setClients] = useCollection<Client>(seedClients);
  const [projects, projectsCrud, setProjects] = useCollection<Project>(seedProjects);
  const [modules, modulesCrud, setModules] = useCollection<Module>(seedModules);
  const [members, membersCrud, setMembers] = useCollection<Member>(seedMembers);
  const [backlog, backlogCrud, setBacklog] = useCollection<BacklogItem>(seedBacklog);
  const [sprints, sprintsCrud, setSprints] = useCollection<Sprint>(seedSprints);

  // Mock auth: the "session" is just a member id in localStorage. Read it
  // after mount to stay SSR-safe (authHydrated gates the redirect logic).
  const AUTH_KEY = "wit-auth-user";
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authHydrated, setAuthHydrated] = useState(false);
  useEffect(() => {
    // One-time hydration from an external system (localStorage). This MUST run
    // post-mount (not a lazy initializer) so server and first client render
    // agree on the logged-out state and avoid a hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setCurrentUserId(window.localStorage.getItem(AUTH_KEY));
    } catch {
      /* localStorage unavailable — stay logged out */
    }
    setAuthHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);
  const currentUser = members.find((m) => m.id === currentUserId) ?? null;
  const login = useCallback((memberId: string) => {
    setCurrentUserId(memberId);
    try {
      window.localStorage.setItem(AUTH_KEY, memberId);
    } catch {
      /* ignore */
    }
  }, []);
  const logout = useCallback(() => {
    setCurrentUserId(null);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  const [tasks, tasksCrud, setTasks] = useCollection<Task>(seedTasks);
  const [decisions, decisionsCrud] = useCollection<Decision>(seedDecisions);

  const [workspaceConf, setWorkspaceConf] =
    useState<WorkspaceConf>(workspaceDefaults);
  const [roles, , setRoles] = useCollection<RoleDef>(roleMatrix);
  const [reportTemplates, reportTemplatesCrud] =
    useCollection<ReportTemplateDef>(reportTemplateMaster);
  const [dodTemplate, setDodTemplate] = useState<string[]>(defaultDodTemplate);
  const [masters, setMasters] = useState<Masters>(masterLists);

  const togglePermission = useCallback(
    (roleId: string, capability: string) => {
      setRoles((prev) =>
        prev.map((r) =>
          r.id === roleId
            ? {
                ...r,
                permissions: {
                  ...r.permissions,
                  [capability]: !r.permissions[capability],
                },
              }
            : r
        )
      );
    },
    [setRoles]
  );

  const addMasterValue = useCallback(
    (key: MasterListKey, value: string): boolean => {
      const v = value.trim();
      if (!v) return false;
      let added = false;
      setMasters((prev) => {
        if (prev[key].some((x) => x.toLowerCase() === v.toLowerCase())) {
          return prev;
        }
        added = true;
        return { ...prev, [key]: [...prev[key], v] };
      });
      return added;
    },
    []
  );

  const renameMasterValue = useCallback(
    (key: MasterListKey, oldValue: string, newValue: string) => {
      const v = newValue.trim();
      if (!v || v === oldValue) return;
      setMasters((prev) => ({
        ...prev,
        [key]: prev[key].map((x) => (x === oldValue ? v : x)),
      }));
      // Propagate the rename to referencing records so it behaves like real master data.
      if (key === "industries") {
        setClients((prev) =>
          prev.map((c) => (c.industry === oldValue ? { ...c, industry: v } : c))
        );
      } else if (key === "contractTypes") {
        setClients((prev) =>
          prev.map((c) =>
            c.contractType === oldValue ? { ...c, contractType: v } : c
          )
        );
      } else if (key === "priorities") {
        setBacklog((prev) =>
          prev.map((b) => (b.priority === oldValue ? { ...b, priority: v } : b))
        );
        setTasks((prev) =>
          prev.map((t) => (t.priority === oldValue ? { ...t, priority: v } : t))
        );
      } else if (key === "workItemTypes") {
        setBacklog((prev) =>
          prev.map((b) => (b.type === oldValue ? { ...b, type: v } : b))
        );
      } else if (key === "jobRoles") {
        setMembers((prev) =>
          prev.map((m) =>
            m.roleLabel === oldValue ? { ...m, roleLabel: v, role: v } : m
          )
        );
      } else if (key === "skillTags") {
        setMembers((prev) =>
          prev.map((m) => ({
            ...m,
            skillTags: m.skillTags.map((t) => (t === oldValue ? v : t)),
          }))
        );
      }
    },
    [setClients, setBacklog, setTasks, setMembers]
  );

  const removeMasterValue = useCallback((key: MasterListKey, value: string) => {
    setMasters((prev) => ({
      ...prev,
      [key]: prev[key].filter((x) => x !== value),
    }));
  }, []);

  const [viewPrefs, setViewPrefs] = useState<ViewPrefs>({
    board: "kanban",
    sprints: "list",
    projectModules: "list",
  });
  const setViewPref = useCallback(
    <K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K]) => {
      setViewPrefs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const [recentPaths, setRecentPaths] = useState<
    { path: string; label: string }[]
  >([]);
  const recordRecentPath = useCallback((path: string, label: string) => {
    setRecentPaths((prev) =>
      [{ path, label }, ...prev.filter((p) => p.path !== path)].slice(0, 3)
    );
  }, []);

  const [reportQueue, reportQueueCrud] =
    useCollection<QueuedReport>(reportQueueSeed);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(
    []
  );
  const saveGeneratedReport = useCallback((report: GeneratedReport) => {
    setGeneratedReports((prev) => [report, ...prev]);
  }, []);
  const markReportSent = useCallback(
    (reportId: string) => {
      const report = generatedReports.find((r) => r.id === reportId);
      setGeneratedReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: "sent" } : r))
      );
      if (report) {
        // Complete the matching queue item (same mod + report type, not done yet).
        const match = reportQueue.find(
          (q) =>
            q.moduleId === report.moduleId &&
            q.type === report.config.type &&
            q.status !== "done"
        );
        if (match) reportQueueCrud.update(match.id, { status: "done" });
      }
    },
    [generatedReports, reportQueue, reportQueueCrud]
  );

  const [toast, setToast] = useState<ToastState | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [committedSprint, setCommittedSprint] =
    useState<PrototypeState["committedSprint"]>(null);

  const showToast = useCallback(
    (message: string, tone: ToastState["tone"] = "info") => {
      const id = Date.now();
      setToast({ id, message, tone });
      setTimeout(() => {
        setToast((t) => (t?.id === id ? null : t));
      }, 4000);
    },
    []
  );

  const removeModuleCascade = useCallback(
    (moduleId: string) => {
      const removedSprintIds = sprints
        .filter((s) => s.moduleId === moduleId)
        .map((s) => s.id);
      setModules((prev) => prev.filter((p) => p.id !== moduleId));
      setBacklog((prev) => prev.filter((b) => b.moduleId !== moduleId));
      setSprints((prev) => prev.filter((s) => s.moduleId !== moduleId));
      setTasks((prev) =>
        prev.filter((t) => !removedSprintIds.includes(t.sprintId))
      );
    },
    [sprints, setModules, setBacklog, setSprints, setTasks]
  );

  const removeProjectCascade = useCallback(
    (projectId: string) => {
      const removedModuleIds = modules
        .filter((p) => p.projectId === projectId)
        .map((p) => p.id);
      const removedSprintIds = sprints
        .filter((s) => removedModuleIds.includes(s.moduleId))
        .map((s) => s.id);
      setModules((prev) => prev.filter((p) => p.projectId !== projectId));
      setBacklog((prev) =>
        prev.filter((b) => !removedModuleIds.includes(b.moduleId))
      );
      setSprints((prev) =>
        prev.filter((s) => !removedModuleIds.includes(s.moduleId))
      );
      setTasks((prev) =>
        prev.filter((t) => !removedSprintIds.includes(t.sprintId))
      );
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    },
    [modules, sprints, setModules, setProjects, setBacklog, setSprints, setTasks]
  );

  const removeClientCascade = useCallback(
    (clientId: string) => {
      const removedModuleIds = modules
        .filter((p) => p.clientId === clientId)
        .map((p) => p.id);
      const removedSprintIds = sprints
        .filter((s) => removedModuleIds.includes(s.moduleId))
        .map((s) => s.id);
      setProjects((prev) => prev.filter((p) => p.clientId !== clientId));
      setModules((prev) => prev.filter((p) => p.clientId !== clientId));
      setBacklog((prev) =>
        prev.filter((b) => !removedModuleIds.includes(b.moduleId))
      );
      setSprints((prev) =>
        prev.filter((s) => !removedModuleIds.includes(s.moduleId))
      );
      setTasks((prev) =>
        prev.filter((t) => !removedSprintIds.includes(t.sprintId))
      );
      setClients((prev) => prev.filter((c) => c.id !== clientId));
    },
    [modules, sprints, setClients, setProjects, setModules, setBacklog, setSprints, setTasks]
  );

  const moveTask = useCallback(
    (taskId: string, column: BoardColumn): boolean => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return false;
      if (column === "done" && task.dod.some((d) => !d.done)) {
        showToast(
          "Complete the Definition of Done before moving this item to Done.",
          "warning"
        );
        return false;
      }
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, column } : t))
      );
      return true;
    },
    [tasks, setTasks, showToast]
  );

  const toggleDod = useCallback(
    (taskId: string, index: number) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                dod: t.dod.map((d, i) =>
                  i === index ? { ...d, done: !d.done } : d
                ),
              }
            : t
        )
      );
    },
    [setTasks]
  );

  // Committing a sprint must actually write the plan onto the sprint —
  // otherwise planning is a dead end and the board/burndown stay empty.
  const commitSprint = useCallback(
    (
      sprintId: string,
      data: { goal: string; memberIds: string[]; backlogIds: string[] }
    ) => {
      const sprintMembers = data.memberIds.map((memberId) => {
        const member = members.find((m) => m.id === memberId);
        return {
          memberId,
          allocation: member?.allocation ?? 100,
          capacityDays: member?.capacityDays ?? 0,
        };
      });
      const committed = data.backlogIds.reduce(
        (sum, id) => sum + (backlog.find((b) => b.id === id)?.estimate ?? 0),
        0
      );
      setSprints((prev) =>
        prev.map((s) =>
          s.id === sprintId
            ? {
                ...s,
                goal: data.goal.trim() || s.goal,
                members: sprintMembers,
                backlogItemIds: data.backlogIds,
                committed,
                // a committed sprint starts running
                status: s.status === "planning" ? "active" : s.status,
              }
            : s
        )
      );
      setCommittedSprint({ sprintId, ...data });
    },
    [members, backlog, setSprints]
  );

  return (
    <PrototypeContext.Provider
      value={{
        currentUser,
        authHydrated,
        login,
        logout,
        clients,
        projects,
        modules,
        members,
        backlog,
        sprints,
        tasks,
        decisions,
        clientsCrud,
        projectsCrud,
        modulesCrud,
        membersCrud,
        backlogCrud,
        sprintsCrud,
        tasksCrud,
        decisionsCrud,
        removeClientCascade,
        removeProjectCascade,
        removeModuleCascade,
        workspaceConf,
        setWorkspaceConf,
        roles,
        togglePermission,
        reportTemplates,
        reportTemplatesCrud,
        dodTemplate,
        setDodTemplate,
        masters,
        addMasterValue,
        renameMasterValue,
        removeMasterValue,
        viewPrefs,
        setViewPref,
        recentPaths,
        recordRecentPath,
        reportQueue,
        reportQueueCrud,
        generatedReports,
        saveGeneratedReport,
        markReportSent,
        moveTask,
        toggleDod,
        toast,
        showToast,
        aiPanelOpen,
        setAiPanelOpen,
        reportConfig,
        setReportConfig,
        committedSprint,
        commitSprint,
      }}
    >
      {children}
    </PrototypeContext.Provider>
  );
}

export function usePrototype() {
  const ctx = useContext(PrototypeContext);
  if (!ctx) throw new Error("usePrototype must be used within PrototypeProvider");
  return ctx;
}

/**
 * How hard a task is stuck, from the number of things standing in its way.
 *
 * One blocker is a note; three is an escalation. The board, the home triage and
 * the client reports all read this, so they cannot disagree about how bad the
 * same task is.
 */
export type BlockerSeverity = "none" | "low" | "medium" | "high";

export function blockerSeverity(task: { blockers: unknown[] }): BlockerSeverity {
  const n = task.blockers.length;
  if (n === 0) return "none";
  if (n === 1) return "low";
  if (n === 2) return "medium";
  return "high";
}

/** Look up a sprint from the live store (so runtime-created sprints resolve). */
export function useSprint(sprintId: string): Sprint | null {
  const { sprints } = usePrototype();
  return sprints.find((s) => s.id === sprintId) ?? null;
}

/**
 * What a sprint has actually finished, counted from the board.
 *
 * `committed` stays a stored number — it is what the team promised at planning
 * and does not change because a card moved. `completed` must not be stored:
 * nothing in the app wrote it, so a team could finish every task and the charts
 * would still report the seeded figure. The Charts tab tells the reader these
 * come "from task status", and now they do.
 */
export function useSprintProgress(sprintId: string): {
  committed: number;
  completed: number;
  remaining: number;
  percent: number;
} {
  const { sprints, tasks } = usePrototype();
  const sprint = sprints.find((s) => s.id === sprintId);
  const mine = tasks.filter((t) => t.sprintId === sprintId);

  // Fall back to the planned figure only when there is no board to count.
  const committed = mine.length
    ? mine.reduce((sum, t) => sum + t.estimate, 0)
    : (sprint?.committed ?? 0);
  const completed = mine
    .filter((t) => t.column === "done")
    .reduce((sum, t) => sum + t.estimate, 0);

  return {
    committed,
    completed,
    remaining: Math.max(0, committed - completed),
    percent: committed > 0 ? Math.round((completed / committed) * 100) : 0,
  };
}

/**
 * How many tasks are blocked right now across a component's sprints.
 *
 * modules.blockedCount is a seeded counter no user action updates, so clearing
 * every blocker on the board left the component, project and portfolio pages still
 * reporting the original number.
 */
export function blockedCountFor(
  sprints: Sprint[],
  tasks: Task[],
  moduleId: string
): number {
  const ids = new Set(
    sprints.filter((s) => s.moduleId === moduleId).map((s) => s.id)
  );
  return tasks.filter((t) => ids.has(t.sprintId) && t.column === "blocked")
    .length;
}

/** Hook form of blockedCountFor, for a page that shows one component. */
export function useModuleBlocked(moduleId: string): number {
  const { sprints, tasks } = usePrototype();
  return blockedCountFor(sprints, tasks, moduleId);
}
