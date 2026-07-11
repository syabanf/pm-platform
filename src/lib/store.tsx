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
  Product,
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
  products as seedProducts,
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
  products: Product[];
  members: Member[];
  backlog: BacklogItem[];
  sprints: Sprint[];
  tasks: Task[];
  decisions: Decision[];
  clientsCrud: Crud<Client>;
  projectsCrud: Crud<Project>;
  productsCrud: Crud<Product>;
  membersCrud: Crud<Member>;
  backlogCrud: Crud<BacklogItem>;
  sprintsCrud: Crud<Sprint>;
  tasksCrud: Crud<Task>;
  decisionsCrud: Crud<Decision>;
  removeClientCascade: (clientId: string) => void;
  removeProjectCascade: (projectId: string) => void;
  removeProductCascade: (productId: string) => void;
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
  committedSprint: { goal: string; memberIds: string[]; backlogIds: string[] } | null;
  commitSprint: (data: { goal: string; memberIds: string[]; backlogIds: string[] }) => void;
}

const PrototypeContext = createContext<PrototypeState | null>(null);

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  const [clients, clientsCrud, setClients] = useCollection<Client>(seedClients);
  const [projects, projectsCrud, setProjects] = useCollection<Project>(seedProjects);
  const [products, productsCrud, setProducts] = useCollection<Product>(seedProducts);
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
        // Complete the matching queue item (same product + report type, not done yet).
        const match = reportQueue.find(
          (q) =>
            q.productId === report.productId &&
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

  const removeProductCascade = useCallback(
    (productId: string) => {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      setBacklog((prev) => prev.filter((b) => b.productId !== productId));
      setSprints((prev) => prev.filter((s) => s.productId !== productId));
    },
    [setProducts, setBacklog, setSprints]
  );

  const removeProjectCascade = useCallback(
    (projectId: string) => {
      const removedProductIds = products
        .filter((p) => p.projectId === projectId)
        .map((p) => p.id);
      setProducts((prev) => prev.filter((p) => p.projectId !== projectId));
      setBacklog((prev) =>
        prev.filter((b) => !removedProductIds.includes(b.productId))
      );
      setSprints((prev) =>
        prev.filter((s) => !removedProductIds.includes(s.productId))
      );
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    },
    [products, setProducts, setProjects, setBacklog, setSprints]
  );

  const removeClientCascade = useCallback(
    (clientId: string) => {
      const removedProductIds = products
        .filter((p) => p.clientId === clientId)
        .map((p) => p.id);
      setProjects((prev) => prev.filter((p) => p.clientId !== clientId));
      setProducts((prev) => prev.filter((p) => p.clientId !== clientId));
      setBacklog((prev) =>
        prev.filter((b) => !removedProductIds.includes(b.productId))
      );
      setSprints((prev) =>
        prev.filter((s) => !removedProductIds.includes(s.productId))
      );
      setClients((prev) => prev.filter((c) => c.id !== clientId));
    },
    [products, setClients, setProjects, setProducts, setBacklog, setSprints]
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

  const commitSprint = useCallback(
    (data: { goal: string; memberIds: string[]; backlogIds: string[] }) => {
      setCommittedSprint(data);
    },
    []
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
        products,
        members,
        backlog,
        sprints,
        tasks,
        decisions,
        clientsCrud,
        projectsCrud,
        productsCrud,
        membersCrud,
        backlogCrud,
        sprintsCrud,
        tasksCrud,
        decisionsCrud,
        removeClientCascade,
        removeProjectCascade,
        removeProductCascade,
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

/** Look up a sprint from the live store (so runtime-created sprints resolve). */
export function useSprint(sprintId: string): Sprint | null {
  const { sprints } = usePrototype();
  return sprints.find((s) => s.id === sprintId) ?? null;
}
