"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BacklogItem,
  BoardColumn,
  Client,
  ClientFeedback,
  DemoItem,
  Decision,
  GeneratedReport,
  Member,
  Module,
  Project,
  QueuedReport,
  ReportConfig,
  RetroAction,
  RetroNote,
  Sprint,
  Task,
} from "./types";
import {
  backlog as seedBacklog,
  clientFeedback as seedClientFeedback,
  clients as seedClients,
  demoItems as seedDemoItems,
  decisions as seedDecisions,
  defaultDodTemplate,
  masterLists,
  members as seedMembers,
  modules as seedModules,
  projects as seedProjects,
  reportQueueSeed,
  reportTemplateMaster,
  retroActions as seedRetroActions,
  retroNotes as seedRetroNotes,
  roleMatrix,
  sprints as seedSprints,
  tasks as seedTasks,
  workspaceDefaults,
  type MasterListKey,
  type ReportTemplateDef,
  type RoleDef,
} from "./data";
import * as persist from "./api/persist";
import { loadWorkspace, type WorkspaceData } from "./api/workspace";
import {
  getSessionToken,
  login as apiLogin,
  logout as apiLogout,
  setSessionToken,
} from "./api/client";

/**
 * Where the records live.
 *
 * `api` is the product: the Go backend owns the data and every change goes
 * there. `seed` is the prototype's in-memory store, kept for the Playwright
 * suite and for a demo with no backend; set NEXT_PUBLIC_DATA_SOURCE=seed.
 */
export const dataSource: "api" | "seed" =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "seed" ? "seed" : "api";

const live = dataSource === "api";

/** The seed in prototype mode; nothing until the snapshot arrives otherwise. */
const initial = <T,>(seed: T[]): T[] => (live ? [] : seed);

/** The profile the backend signed in; remembered across reloads. */
interface Profile {
  id: string;
  email: string;
  name: string;
  role: string;
  memberId: string | null;
}

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

/**
 * A collection with optional persistence.
 *
 * Every change lands in the array first, so the page answers at once; the
 * server call follows. When the server refuses, the array goes back to what
 * it was and `fail` carries the server's reason to a toast. With no persister
 * (seed mode) this is the plain in-memory store it always was.
 */
function useCollection<T extends { id: string }>(
  seed: T[],
  persister: persist.Persister<T> | null,
  fail: (message: string) => void,
): [T[], Crud<T>, React.Dispatch<React.SetStateAction<T[]>>] {
  const [items, setItems] = useState<T[]>(seed);
  // The record as it was before an update, for the revert and the diff.
  const latest = useRef(items);
  useEffect(() => {
    latest.current = items;
  }, [items]);
  const crud = useMemo<Crud<T>>(
    () => ({
      add: (item) => {
        setItems((prev) => [...prev, item]);
        persister?.add(item).catch((e: Error) => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          fail(e.message);
        });
      },
      update: (id, patch) => {
        const before = latest.current.find((i) => i.id === id);
        setItems((prev) =>
          prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        );
        if (!persister || !before) return;
        const after = { ...before, ...patch };
        persister.update(id, patch, before, after).catch((e: Error) => {
          setItems((prev) => prev.map((i) => (i.id === id ? before : i)));
          fail(e.message);
        });
      },
      remove: (id) => {
        const before = latest.current.find((i) => i.id === id);
        setItems((prev) => prev.filter((i) => i.id !== id));
        if (!persister || !before) return;
        persister.remove(id, before).catch((e: Error) => {
          setItems(restoreById([before]));
          fail(e.message);
        });
      },
    }),
    [persister, fail],
  );
  return [items, crud, setItems];
}

/** An optional button on a toast — "Undo" on a delete, say. */
interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastState {
  id: number;
  message: string;
  tone: "info" | "warning" | "success";
  action?: ToastAction;
}

/**
 * Re-insert a deleted snapshot, skipping any id already back — so pressing Undo
 * twice cannot duplicate a row. Restore order does not matter for these arrays.
 */
function restoreById<T extends { id: string }>(snapshot: T[]) {
  return (prev: T[]) => {
    const have = new Set(prev.map((x) => x.id));
    return [...prev, ...snapshot.filter((x) => !have.has(x.id))];
  };
}

interface PrototypeState {
  /** `api` or `seed`; the login screen and the shell adapt to it. */
  dataSource: "api" | "seed";
  // --- auth: a backend session in api mode, a member id in seed mode ---
  currentUser: Member | null;
  authHydrated: boolean;
  /** Seed mode: sign in as a member, no password. */
  login: (memberId: string) => void;
  /** Api mode: sign in against the backend; rejects with its reason. */
  signIn: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Api mode: where the first load stands. Seed mode is always ready. */
  loadState: "loading" | "ready" | "error";
  loadError: string | null;
  retryLoad: () => void;

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
  clientsCrud: Crud<Client>;
  projectsCrud: Crud<Project>;
  modulesCrud: Crud<Module>;
  membersCrud: Crud<Member>;
  backlogCrud: Crud<BacklogItem>;
  sprintsCrud: Crud<Sprint>;
  tasksCrud: Crud<Task>;
  decisionsCrud: Crud<Decision>;
  retroNotesCrud: Crud<RetroNote>;
  retroActionsCrud: Crud<RetroAction>;
  demoItemsCrud: Crud<DemoItem>;
  clientFeedbackCrud: Crud<ClientFeedback>;
  // Each returns an undo: the whole snapshotted subtree goes back on call.
  removeClientCascade: (clientId: string) => () => void;
  removeProjectCascade: (projectId: string) => () => void;
  removeModuleCascade: (moduleId: string) => () => void;
  workspaceConf: WorkspaceConf;
  setWorkspaceConf: (conf: WorkspaceConf) => void;
  roles: RoleDef[];
  togglePermission: (roleId: string, capability: string) => void;
  reportTemplates: ReportTemplateDef[];
  reportTemplatesCrud: Crud<ReportTemplateDef>;
  /** Renames a template and repoints every report that referenced it. */
  renameReportTemplate: (templateId: string, newName: string) => void;
  /** Deletes a template, returning an undo — reports name templates by string. */
  removeReportTemplate: (templateId: string) => () => void;
  dodTemplate: string[];
  setDodTemplate: (items: string[]) => void;
  masters: Masters;
  addMasterValue: (key: MasterListKey, value: string) => boolean;
  /** False when the rename was refused — empty, unchanged, or a duplicate. */
  renameMasterValue: (
    key: MasterListKey,
    oldValue: string,
    newValue: string,
  ) => boolean;
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
  showToast: (
    message: string,
    tone?: ToastState["tone"],
    action?: ToastAction,
  ) => void;
  dismissToast: () => void;
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
    data: { goal: string; memberIds: string[]; backlogIds: string[] },
  ) => void;
}

const PrototypeContext = createContext<PrototypeState | null>(null);

const AUTH_KEY = "wit-auth-user";
const PROFILE_KEY = "wit-auth-profile";

function readProfile(): Profile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

function writeProfile(profile: Profile | null) {
  try {
    if (profile)
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else window.localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}

export function PrototypeProvider({ children }: { children: React.ReactNode }) {
  // Server refusals surface as a toast; the toast is defined further down, so
  // the collections reach it through a ref.
  const failRef = useRef<(message: string) => void>(() => {});
  const fail = useCallback((message: string) => failRef.current(message), []);
  const P = live ? persist : null;

  const [clients, clientsCrud, setClients] = useCollection<Client>(
    initial(seedClients),
    P && P.clients,
    fail,
  );
  const [projects, projectsCrud, setProjects] = useCollection<Project>(
    initial(seedProjects),
    P && P.projects,
    fail,
  );
  const [modules, modulesCrud, setModules] = useCollection<Module>(
    initial(seedModules),
    P && P.modules,
    fail,
  );
  const [members, membersCrud, setMembers] = useCollection<Member>(
    initial(seedMembers),
    P && P.members,
    fail,
  );
  const [backlog, backlogCrud, setBacklog] = useCollection<BacklogItem>(
    initial(seedBacklog),
    P && P.backlog,
    fail,
  );
  const [sprints, sprintsCrud, setSprints] = useCollection<Sprint>(
    initial(seedSprints),
    P && P.sprints,
    fail,
  );
  const [tasks, tasksCrud, setTasks] = useCollection<Task>(
    initial(seedTasks),
    P && P.tasks,
    fail,
  );
  const [decisions, decisionsCrud, setDecisions] = useCollection<Decision>(
    initial(seedDecisions),
    P && P.decisions,
    fail,
  );
  // Retro and review records, keyed by sprint. Same idiom as every other
  // collection here — a retro action is edited the way a decision is.
  const [retroNotes, retroNotesCrud, setRetroNotes] = useCollection<RetroNote>(
    initial(seedRetroNotes),
    P && P.retroNotes,
    fail,
  );
  const [retroActions, retroActionsCrud, setRetroActions] =
    useCollection<RetroAction>(
      initial(seedRetroActions),
      P && P.retroActions,
      fail,
    );
  const [demoItems, demoItemsCrud, setDemoItems] = useCollection<DemoItem>(
    initial(seedDemoItems),
    P && P.demoItems,
    fail,
  );
  const [clientFeedback, clientFeedbackCrud, setClientFeedback] =
    useCollection<ClientFeedback>(
      initial(seedClientFeedback),
      P && P.clientFeedback,
      fail,
    );

  const [workspaceConf, setWorkspaceConfState] =
    useState<WorkspaceConf>(workspaceDefaults);
  const [roles, , setRoles] = useCollection<RoleDef>(
    initial(roleMatrix),
    null,
    fail,
  );
  const [reportTemplates, reportTemplatesCrud, setReportTemplates] =
    useCollection<ReportTemplateDef>(
      initial(reportTemplateMaster),
      P && P.reportTemplates,
      fail,
    );
  const [dodTemplate, setDodTemplateState] = useState<string[]>(
    live ? [] : defaultDodTemplate,
  );
  const [masters, setMasters] = useState<Masters>(masterLists);
  const [reportQueue, reportQueueCrud, setReportQueue] =
    useCollection<QueuedReport>(
      initial(reportQueueSeed),
      P && P.reportQueue,
      fail,
    );
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(
    [],
  );

  // --- auth and the first load -------------------------------------------
  //
  // Seed mode: the session is a member id in localStorage, read after mount
  // so server and first client render agree on the logged-out state.
  //
  // Api mode: a session token plus the signed-in profile, also in
  // localStorage. A token means "load the workspace"; the shell waits on
  // loadState before it lets a page render.
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    live ? "loading" : "ready",
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  const applyWorkspace = useCallback(
    (w: WorkspaceData) => {
      setClients(w.clients);
      setProjects(w.projects);
      setModules(w.modules);
      setMembers(w.members);
      setBacklog(w.backlog);
      setSprints(w.sprints);
      setTasks(w.tasks);
      setDecisions(w.decisions);
      setRetroNotes(w.retroNotes);
      setRetroActions(w.retroActions);
      setDemoItems(w.demoItems);
      setClientFeedback(w.clientFeedback);
      setRoles(w.roles);
      setReportTemplates(w.reportTemplates);
      setReportQueue(w.reportQueue);
      setGeneratedReports(w.generatedReports);
      setMasters(w.masters);
      setWorkspaceConfState(w.workspaceConf);
      setDodTemplateState(w.dodTemplate);
    },
    [
      setClients,
      setProjects,
      setModules,
      setMembers,
      setBacklog,
      setSprints,
      setTasks,
      setDecisions,
      setRetroNotes,
      setRetroActions,
      setDemoItems,
      setClientFeedback,
      setRoles,
      setReportTemplates,
      setReportQueue,
    ],
  );

  /** Fetch the workspace again behind the current screen, without the splash. */
  const refresh = useCallback(
    () =>
      loadWorkspace()
        .then(applyWorkspace)
        .catch((e: Error) => fail(e.message)),
    [applyWorkspace, fail],
  );

  const load = useCallback(() => {
    setLoadState("loading");
    setLoadError(null);
    loadWorkspace()
      .then((w) => {
        applyWorkspace(w);
        setLoadState("ready");
      })
      .catch((e: Error) => {
        setLoadError(e.message);
        setLoadState("error");
      });
  }, [applyWorkspace]);

  useEffect(() => {
    // One-time hydration from localStorage. This MUST run post-mount (not a
    // lazy initializer) to avoid a hydration mismatch.
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setCurrentUserId(window.localStorage.getItem(AUTH_KEY));
    } catch {
      /* localStorage unavailable — stay logged out */
    }
    if (live) {
      setProfile(readProfile());
      if (getSessionToken()) load();
      else setLoadState("ready");
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [load]);

  // In api mode a signed-in account acts as the member it is linked to, or
  // the member with its address, or as itself when it has no member row.
  const currentUser = useMemo<Member | null>(() => {
    const byId = members.find((m) => m.id === currentUserId);
    if (byId) return byId;
    if (!live || !profile || !getSessionToken()) return null;
    return (
      members.find(
        (m) => m.email.toLowerCase() === profile.email.toLowerCase(),
      ) ?? {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        roleLabel:
          roles.find((r) => r.id === profile.role)?.name ?? profile.role,
        skillTags: [],
        allocation: 100,
        capacityDays: 0,
        workload: 0,
        status: "active",
      }
    );
  }, [members, roles, currentUserId, profile]);

  const authHydrated = hydrated && loadState !== "loading";

  const login = useCallback((memberId: string) => {
    setCurrentUserId(memberId);
    try {
      window.localStorage.setItem(AUTH_KEY, memberId);
    } catch {
      /* ignore */
    }
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const user = await apiLogin(email, password);
      const next: Profile = {
        id: user.id ?? "",
        email: user.email ?? email,
        name: user.name ?? "",
        role: user.role ?? "",
        memberId: user.memberId ?? null,
      };
      writeProfile(next);
      setProfile(next);
      login(next.memberId ?? "");
      load();
    },
    [login, load],
  );

  const logout = useCallback(() => {
    setCurrentUserId(null);
    setProfile(null);
    writeProfile(null);
    try {
      window.localStorage.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    if (live) {
      apiLogout().catch(() => setSessionToken(null));
    }
  }, []);

  const togglePermission = useCallback(
    (roleId: string, capability: string) => {
      const before = roles.find((r) => r.id === roleId);
      if (!before) return;
      const after: RoleDef = {
        ...before,
        permissions: {
          ...before.permissions,
          [capability]: !before.permissions[capability],
        },
      };
      setRoles((prev) => prev.map((r) => (r.id === roleId ? after : r)));
      P?.saveRole(after).catch((e: Error) => {
        setRoles((prev) => prev.map((r) => (r.id === roleId ? before : r)));
        fail(e.message);
      });
    },
    [roles, setRoles, P, fail],
  );

  const setWorkspaceConf = useCallback(
    (conf: WorkspaceConf) => {
      const before = workspaceConf;
      setWorkspaceConfState(conf);
      P?.saveSettings(conf, dodTemplate).catch((e: Error) => {
        setWorkspaceConfState(before);
        fail(e.message);
      });
    },
    [workspaceConf, dodTemplate, P, fail],
  );

  const setDodTemplate = useCallback(
    (items: string[]) => {
      const before = dodTemplate;
      setDodTemplateState(items);
      P?.saveSettings(workspaceConf, items).catch((e: Error) => {
        setDodTemplateState(before);
        fail(e.message);
      });
    },
    [workspaceConf, dodTemplate, P, fail],
  );

  const addMasterValue = useCallback(
    (key: MasterListKey, value: string): boolean => {
      const v = value.trim();
      if (!v) return false;
      if (masters[key].some((x) => x.toLowerCase() === v.toLowerCase())) {
        return false;
      }
      setMasters((prev) => ({ ...prev, [key]: [...prev[key], v] }));
      P?.addMasterValue(key, v, masters[key].length).catch((e: Error) => {
        setMasters((prev) => ({
          ...prev,
          [key]: prev[key].filter((x) => x !== v),
        }));
        fail(e.message);
      });
      return true;
    },
    [masters, P, fail],
  );

  const renameMasterValue = useCallback(
    (key: MasterListKey, oldValue: string, newValue: string): boolean => {
      const v = newValue.trim();
      if (!v || v === oldValue) return false;
      // Renaming onto a value that already exists would leave two identical
      // rows, and the list editor keys on the value — so Edit and Delete would
      // both act on the pair. Adding already refuses duplicates; so does this.
      // Excluding the row being renamed — otherwise it collides with itself
      // and a case-only rename ("qa" to "QA") can never succeed.
      if (
        masters[key].some(
          (x) => x !== oldValue && x.toLowerCase() === v.toLowerCase(),
        )
      )
        return false;
      setMasters((prev) => ({
        ...prev,
        [key]: prev[key].map((x) => (x === oldValue ? v : x)),
      }));
      P?.renameMasterValue(key, oldValue, v).catch((e: Error) => {
        setMasters((prev) => ({
          ...prev,
          [key]: prev[key].map((x) => (x === v ? oldValue : x)),
        }));
        fail(e.message);
      });
      // Propagate the rename to referencing records so it behaves like real master data.
      if (key === "industries") {
        setClients((prev) =>
          prev.map((c) =>
            c.industry === oldValue ? { ...c, industry: v } : c,
          ),
        );
      } else if (key === "contractTypes") {
        setClients((prev) =>
          prev.map((c) =>
            c.contractType === oldValue ? { ...c, contractType: v } : c,
          ),
        );
      } else if (key === "priorities") {
        setBacklog((prev) =>
          prev.map((b) =>
            b.priority === oldValue ? { ...b, priority: v } : b,
          ),
        );
        setTasks((prev) =>
          prev.map((t) =>
            t.priority === oldValue ? { ...t, priority: v } : t,
          ),
        );
      } else if (key === "workItemTypes") {
        setBacklog((prev) =>
          prev.map((b) => (b.type === oldValue ? { ...b, type: v } : b)),
        );
      } else if (key === "jobRoles") {
        setMembers((prev) =>
          prev.map((m) =>
            m.roleLabel === oldValue ? { ...m, roleLabel: v, role: v } : m,
          ),
        );
      } else if (key === "skillTags") {
        setMembers((prev) =>
          prev.map((m) => ({
            ...m,
            skillTags: m.skillTags.map((t) => (t === oldValue ? v : t)),
          })),
        );
      } else if (key === "reportFrequencies") {
        setReportTemplates((prev) =>
          prev.map((t) =>
            t.frequency === oldValue ? { ...t, frequency: v } : t,
          ),
        );
      } else if (key === "reportFormats") {
        setReportTemplates((prev) =>
          prev.map((t) => ({
            ...t,
            formats: t.formats.map((f) => (f === oldValue ? v : f)),
          })),
        );
      }
      return true;
    },
    [
      masters,
      setClients,
      setBacklog,
      setTasks,
      setMembers,
      setReportTemplates,
      P,
      fail,
    ],
  );

  const removeMasterValue = useCallback(
    (key: MasterListKey, value: string) => {
      setMasters((prev) => ({
        ...prev,
        [key]: prev[key].filter((x) => x !== value),
      }));
      P?.removeMasterValue(key, value).catch((e: Error) => {
        setMasters((prev) => ({ ...prev, [key]: [...prev[key], value] }));
        fail(e.message);
      });
    },
    [P, fail],
  );

  const [viewPrefs, setViewPrefs] = useState<ViewPrefs>({
    board: "kanban",
    sprints: "list",
    projectModules: "list",
  });
  const setViewPref = useCallback(
    <K extends keyof ViewPrefs>(key: K, value: ViewPrefs[K]) => {
      setViewPrefs((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const [recentPaths, setRecentPaths] = useState<
    { path: string; label: string }[]
  >([]);
  const recordRecentPath = useCallback((path: string, label: string) => {
    setRecentPaths((prev) =>
      [{ path, label }, ...prev.filter((p) => p.path !== path)].slice(0, 3),
    );
  }, []);

  const saveGeneratedReport = useCallback(
    (report: GeneratedReport) => {
      setGeneratedReports((prev) => [report, ...prev]);
      P?.saveGeneratedReport(report).catch((e: Error) => {
        setGeneratedReports((prev) => prev.filter((r) => r.id !== report.id));
        fail(e.message);
      });
    },
    [P, fail],
  );
  const markReportSent = useCallback(
    (reportId: string) => {
      const report = generatedReports.find((r) => r.id === reportId);
      setGeneratedReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: "sent" } : r)),
      );
      P?.markReportSent(reportId).catch((e: Error) => {
        setGeneratedReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: "draft" } : r)),
        );
        fail(e.message);
      });
      if (report) {
        // Complete the matching queue item (same mod + report type, not done yet).
        const match = reportQueue.find(
          (q) =>
            q.moduleId === report.moduleId &&
            q.type === report.config.type &&
            q.status !== "done",
        );
        if (match) reportQueueCrud.update(match.id, { status: "done" });
      }
    },
    [generatedReports, reportQueue, reportQueueCrud, P, fail],
  );

  /**
   * Rename a report template, and rewrite everything that named it.
   *
   * Reports store their template by name, so a plain rename orphaned every
   * report already generated from it: the lookup missed, the body came back
   * empty, and the page blamed the user for a template with "no sections
   * switched on". A rename is a rewrite here, the same as it is for a master
   * list value. The API does the same rewrite when the template is saved, so
   * this keeps the screen in step until the server answers.
   */
  const renameReportTemplate = useCallback(
    (templateId: string, newName: string) => {
      const from = reportTemplates.find((t) => t.id === templateId)?.name;
      if (!from || from === newName) return;
      setGeneratedReports((prev) =>
        prev.map((r) =>
          r.config.template === from
            ? { ...r, config: { ...r.config, template: newName } }
            : r,
        ),
      );
      setReportQueue((prev) =>
        prev.map((q) =>
          q.template === from ? { ...q, template: newName } : q,
        ),
      );
    },
    [reportTemplates, setReportQueue],
  );

  /**
   * Delete a template, and give back an undo.
   *
   * Reports name their template by string, so a plain delete left every report
   * generated from it rendering a header and the line "this template has no
   * sections switched on" — advice pointing at a Settings page where the
   * template no longer exists. Nothing was recoverable. This snapshots the
   * template the same way the client/project/module cascades snapshot theirs.
   */
  const removeReportTemplate = useCallback(
    (templateId: string) => {
      const snapshot = reportTemplates.filter((t) => t.id === templateId);
      setReportTemplates((prev) => prev.filter((t) => t.id !== templateId));
      P?.reportTemplates.remove(templateId, snapshot[0]).catch((e: Error) => {
        setReportTemplates(restoreById(snapshot));
        fail(e.message);
      });
      return () => {
        setReportTemplates(restoreById(snapshot));
        for (const t of snapshot)
          P?.reportTemplates.add(t).catch((e: Error) => fail(e.message));
      };
    },
    [reportTemplates, setReportTemplates, P, fail],
  );

  const [toast, setToast] = useState<ToastState | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);
  const [committedSprint, setCommittedSprint] =
    useState<PrototypeState["committedSprint"]>(null);

  const showToast = useCallback(
    (
      message: string,
      tone: ToastState["tone"] = "info",
      action?: ToastAction,
    ) => {
      const id = Date.now();
      setToast({ id, message, tone, action });
      // An actionable toast lingers longer — four seconds is barely enough to
      // notice a message, let alone read it and decide to undo.
      setTimeout(
        () => setToast((t) => (t?.id === id ? null : t)),
        action ? 8000 : 4000,
      );
    },
    [],
  );

  const dismissToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    failRef.current = (message) => showToast(message, "warning");
  }, [showToast]);

  /**
   * Undo for a cascade: the arrays go back, and the server restores the
   * subtree from the trash. `trashed` resolves to the trash id once the delete
   * has landed, or to nothing when it failed and the arrays are already back.
   * The restore brings back rows the arrays never held (decisions, reports,
   * retro notes), so the workspace is fetched again afterwards.
   */
  const undoCascade = useCallback(
    (trashed: Promise<string | void> | undefined, restore: () => void) =>
      () => {
        restore();
        trashed
          ?.then(async (id) => {
            if (!id || !P) return;
            await P.restoreTrash(id);
            await refresh();
          })
          .catch((e: Error) => fail(e.message));
      },
    [P, fail, refresh],
  );

  const removeModuleCascade = useCallback(
    (moduleId: string) => {
      // Snapshot every row about to go, so Undo can put the whole subtree back.
      const gone = {
        modules: modules.filter((p) => p.id === moduleId),
        backlog: backlog.filter((b) => b.moduleId === moduleId),
        sprints: sprints.filter((s) => s.moduleId === moduleId),
        tasks: [] as Task[],
      };
      const removedSprintIds = gone.sprints.map((s) => s.id);
      gone.tasks = tasks.filter((t) => removedSprintIds.includes(t.sprintId));

      setModules((prev) => prev.filter((p) => p.id !== moduleId));
      setBacklog((prev) => prev.filter((b) => b.moduleId !== moduleId));
      setSprints((prev) => prev.filter((s) => s.moduleId !== moduleId));
      setTasks((prev) =>
        prev.filter((t) => !removedSprintIds.includes(t.sprintId)),
      );
      const restore = () => {
        setModules(restoreById(gone.modules));
        setBacklog(restoreById(gone.backlog));
        setSprints(restoreById(gone.sprints));
        setTasks(restoreById(gone.tasks));
      };
      // The server cascades from the module, so one call removes the tree.
      const trashed = P?.modules
        .remove(moduleId, gone.modules[0])
        .catch((e: Error) => {
          restore();
          fail(e.message);
        });
      return undoCascade(trashed, restore);
    },
    [
      modules,
      backlog,
      sprints,
      tasks,
      setModules,
      setBacklog,
      setSprints,
      setTasks,
      P,
      fail,
      undoCascade,
    ],
  );

  const removeProjectCascade = useCallback(
    (projectId: string) => {
      const removedModules = modules.filter((p) => p.projectId === projectId);
      const removedModuleIds = removedModules.map((p) => p.id);
      const removedSprints = sprints.filter((s) =>
        removedModuleIds.includes(s.moduleId),
      );
      const removedSprintIds = removedSprints.map((s) => s.id);
      const gone = {
        projects: projects.filter((p) => p.id === projectId),
        modules: removedModules,
        backlog: backlog.filter((b) => removedModuleIds.includes(b.moduleId)),
        sprints: removedSprints,
        tasks: tasks.filter((t) => removedSprintIds.includes(t.sprintId)),
      };

      setModules((prev) => prev.filter((p) => p.projectId !== projectId));
      setBacklog((prev) =>
        prev.filter((b) => !removedModuleIds.includes(b.moduleId)),
      );
      setSprints((prev) =>
        prev.filter((s) => !removedModuleIds.includes(s.moduleId)),
      );
      setTasks((prev) =>
        prev.filter((t) => !removedSprintIds.includes(t.sprintId)),
      );
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      const restore = () => {
        setProjects(restoreById(gone.projects));
        setModules(restoreById(gone.modules));
        setBacklog(restoreById(gone.backlog));
        setSprints(restoreById(gone.sprints));
        setTasks(restoreById(gone.tasks));
      };
      const trashed = P?.projects
        .remove(projectId, gone.projects[0])
        .catch((e: Error) => {
          restore();
          fail(e.message);
        });
      return undoCascade(trashed, restore);
    },
    [
      modules,
      sprints,
      projects,
      backlog,
      tasks,
      setModules,
      setProjects,
      setBacklog,
      setSprints,
      setTasks,
      P,
      fail,
      undoCascade,
    ],
  );

  const removeClientCascade = useCallback(
    (clientId: string) => {
      const removedModules = modules.filter((p) => p.clientId === clientId);
      const removedModuleIds = removedModules.map((p) => p.id);
      const removedSprints = sprints.filter((s) =>
        removedModuleIds.includes(s.moduleId),
      );
      const removedSprintIds = removedSprints.map((s) => s.id);
      const gone = {
        clients: clients.filter((c) => c.id === clientId),
        projects: projects.filter((p) => p.clientId === clientId),
        modules: removedModules,
        backlog: backlog.filter((b) => removedModuleIds.includes(b.moduleId)),
        sprints: removedSprints,
        tasks: tasks.filter((t) => removedSprintIds.includes(t.sprintId)),
      };

      setProjects((prev) => prev.filter((p) => p.clientId !== clientId));
      setModules((prev) => prev.filter((p) => p.clientId !== clientId));
      setBacklog((prev) =>
        prev.filter((b) => !removedModuleIds.includes(b.moduleId)),
      );
      setSprints((prev) =>
        prev.filter((s) => !removedModuleIds.includes(s.moduleId)),
      );
      setTasks((prev) =>
        prev.filter((t) => !removedSprintIds.includes(t.sprintId)),
      );
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      const restore = () => {
        setClients(restoreById(gone.clients));
        setProjects(restoreById(gone.projects));
        setModules(restoreById(gone.modules));
        setBacklog(restoreById(gone.backlog));
        setSprints(restoreById(gone.sprints));
        setTasks(restoreById(gone.tasks));
      };
      const trashed = P?.clients
        .remove(clientId, gone.clients[0])
        .catch((e: Error) => {
          restore();
          fail(e.message);
        });
      return undoCascade(trashed, restore);
    },
    [
      clients,
      modules,
      sprints,
      projects,
      backlog,
      tasks,
      setClients,
      setProjects,
      setModules,
      setBacklog,
      setSprints,
      setTasks,
      P,
      fail,
      undoCascade,
    ],
  );

  const moveTask = useCallback(
    (taskId: string, column: BoardColumn): boolean => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return false;
      if (column === "done" && task.dod.some((d) => !d.done)) {
        showToast(
          "Complete the Definition of Done before moving this item to Done.",
          "warning",
        );
        return false;
      }
      const from = task.column;
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, column } : t)),
      );
      P?.moveTask(taskId, column).catch((e: Error) => {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, column: from } : t)),
        );
        fail(e.message);
      });
      return true;
    },
    [tasks, setTasks, showToast, P, fail],
  );

  const toggleDod = useCallback(
    (taskId: string, index: number) => {
      const flip = (prev: Task[]) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                dod: t.dod.map((d, i) =>
                  i === index ? { ...d, done: !d.done } : d,
                ),
              }
            : t,
        );
      setTasks(flip);
      P?.toggleDod(taskId, index).catch((e: Error) => {
        setTasks(flip);
        fail(e.message);
      });
    },
    [setTasks, P, fail],
  );

  // Committing a sprint must actually write the plan onto the sprint —
  // otherwise planning is a dead end and the board/burndown stay empty.
  const commitSprint = useCallback(
    (
      sprintId: string,
      data: { goal: string; memberIds: string[]; backlogIds: string[] },
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
        0,
      );
      const before = sprints.find((s) => s.id === sprintId);
      if (!before) return;
      const patch: Partial<Sprint> = {
        goal: data.goal.trim() || before.goal,
        members: sprintMembers,
        backlogItemIds: data.backlogIds,
        committed,
        // a committed sprint starts running
        status: before.status === "planning" ? "active" : before.status,
      };
      sprintsCrud.update(sprintId, patch);
      setCommittedSprint({ sprintId, ...data });
    },
    [members, backlog, sprints, sprintsCrud],
  );

  return (
    <PrototypeContext.Provider
      value={{
        dataSource,
        currentUser,
        authHydrated,
        login,
        signIn,
        logout,
        loadState,
        loadError,
        retryLoad: load,
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
        retroNotes,
        retroActions,
        demoItems,
        clientFeedback,
        retroNotesCrud,
        retroActionsCrud,
        demoItemsCrud,
        clientFeedbackCrud,
        removeClientCascade,
        removeProjectCascade,
        removeModuleCascade,
        workspaceConf,
        setWorkspaceConf,
        roles,
        togglePermission,
        reportTemplates,
        reportTemplatesCrud,
        renameReportTemplate,
        removeReportTemplate,
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
        dismissToast,
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
  if (!ctx)
    throw new Error("usePrototype must be used within PrototypeProvider");
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

export function blockerSeverity(task: {
  blockers: unknown[];
}): BlockerSeverity {
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
  moduleId: string,
): number {
  const ids = new Set(
    sprints.filter((s) => s.moduleId === moduleId).map((s) => s.id),
  );
  return tasks.filter((t) => ids.has(t.sprintId) && t.column === "blocked")
    .length;
}

/** Hook form of blockedCountFor, for a page that shows one component. */
export function useModuleBlocked(moduleId: string): number {
  const { sprints, tasks } = usePrototype();
  return blockedCountFor(sprints, tasks, moduleId);
}
