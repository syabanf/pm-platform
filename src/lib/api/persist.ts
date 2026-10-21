import type {
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
import type { ReportTemplateDef, RoleDef } from "../data";
import type { workspaceDefaults } from "../data";
import { api } from "./client";
import { apiError } from "./workspace";

/**
 * How a collection reaches the server.
 *
 * The store applies every change to its own arrays first and calls these
 * afterwards; a rejection makes it put the arrays back and show the reason.
 * `before` and `after` are the record around an update, because a sprint's
 * members or a module's components are sub-resources on the API and the
 * difference between the two is what has to be sent.
 */
export interface Persister<T extends { id: string }> {
  add: (item: T) => Promise<void>;
  update: (id: string, patch: Partial<T>, before: T, after: T) => Promise<void>;
  /** A cascade delete resolves to the trash id its undo needs. */
  remove: (id: string, before: T) => Promise<string | void>;
}

type Result = { error?: unknown; response: Response };

/** Throw with the server's reason when a call failed. */
async function ok(call: Promise<Result>, what: string): Promise<void> {
  const { error, response } = await call;
  if (error || !response.ok) throw apiError(error, `${what} failed`);
}

/** A cascade delete: the server files the subtree and answers with its trash id. */
async function trashed(
  call: Promise<Result & { data?: { trashId: string } }>,
  what: string,
): Promise<string> {
  const { data, error, response } = await call;
  if (error || !response.ok || !data) throw apiError(error, `${what} failed`);
  return data.trashId;
}

/** "" means "none" on the store's side; the API wants the key left out. */
const orUndef = (v: string | undefined) => (v ? v : undefined);

const blank = (v: string | undefined) =>
  v === undefined ? undefined : v || undefined;

/** Ids present in `next` that `prev` lacks, and the reverse. */
function diffIds(prev: string[], next: string[]) {
  const was = new Set(prev);
  const is = new Set(next);
  return {
    added: next.filter((id) => !was.has(id)),
    removed: prev.filter((id) => !is.has(id)),
  };
}

// ---------------------------------------------------------------- clients ---

export const clients: Persister<Client> = {
  add: (c) =>
    ok(
      api.POST("/clients", {
        body: {
          ...c,
          aiInsight: c.aiInsight as unknown as Record<string, never>,
        },
      }),
      "creating the client",
    ),
  update: (id, patch) =>
    ok(
      api.PATCH("/clients/{clientId}", {
        params: { path: { clientId: id } },
        body: {
          ...patch,
          aiInsight: patch.aiInsight as unknown as
            Record<string, never> | undefined,
        },
      }),
      "saving the client",
    ),
  remove: (id) =>
    trashed(
      api.DELETE("/clients/{clientId}", { params: { path: { clientId: id } } }),
      "deleting the client",
    ),
};

export const projects: Persister<Project> = {
  add: (p) => ok(api.POST("/projects", { body: p }), "creating the project"),
  update: (id, patch) =>
    ok(
      api.PATCH("/projects/{projectId}", {
        params: { path: { projectId: id } },
        body: patch,
      }),
      "saving the project",
    ),
  remove: (id) =>
    trashed(
      api.DELETE("/projects/{projectId}", {
        params: { path: { projectId: id } },
      }),
      "deleting the project",
    ),
};

// ---------------------------------------------------------------- modules ---

type ComponentRow = Module["components"][number];

async function syncComponents(
  moduleId: string,
  prev: ComponentRow[],
  next: ComponentRow[],
) {
  const { added, removed } = diffIds(
    prev.map((c) => c.id),
    next.map((c) => c.id),
  );
  for (const id of removed) {
    await ok(
      api.DELETE("/components/{componentId}", {
        params: { path: { componentId: id } },
      }),
      "removing the component",
    );
  }
  for (const [position, c] of next.entries()) {
    if (added.includes(c.id)) {
      await ok(
        api.POST("/modules/{moduleId}/components", {
          params: { path: { moduleId } },
          body: {
            id: c.id,
            name: c.name,
            owner: c.owner,
            status: c.status,
            position,
          },
        }),
        "adding the component",
      );
      continue;
    }
    const was = prev.find((p) => p.id === c.id);
    if (
      was &&
      (was.name !== c.name || was.owner !== c.owner || was.status !== c.status)
    ) {
      await ok(
        api.PATCH("/components/{componentId}", {
          params: { path: { componentId: c.id } },
          body: { name: c.name, owner: c.owner, status: c.status, position },
        }),
        "saving the component",
      );
    }
  }
}

function moduleBody(m: Partial<Module>) {
  return {
    projectId: m.projectId,
    name: m.name,
    goal: m.goal,
    owner: m.owner,
    deliveryLead: m.deliveryLead,
    status: m.status,
    health: m.health,
    risk: m.risk,
    velocity: m.velocity,
    blockedCount: m.blockedCount,
    aiInsight: m.aiInsight as unknown as Record<string, never> | undefined,
  };
}

export const modules: Persister<Module> = {
  add: async (m) => {
    await ok(
      api.POST("/modules", {
        body: {
          id: m.id,
          projectId: m.projectId,
          name: m.name,
          goal: m.goal,
          owner: m.owner,
          deliveryLead: m.deliveryLead,
          status: m.status,
          health: m.health,
          risk: m.risk,
          velocity: m.velocity,
          blockedCount: m.blockedCount,
          aiInsight: m.aiInsight as unknown as Record<string, never>,
        },
      }),
      "creating the module",
    );
    await syncComponents(m.id, [], m.components);
    if (m.currentSprintId) {
      await ok(
        api.PATCH("/modules/{moduleId}/current-sprint", {
          params: { path: { moduleId: m.id } },
          body: { currentSprintId: m.currentSprintId },
        }),
        "setting the current sprint",
      );
    }
  },
  update: async (id, patch, before, after) => {
    const { components, currentSprintId, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      await ok(
        api.PATCH("/modules/{moduleId}", {
          params: { path: { moduleId: id } },
          body: moduleBody(rest),
        }),
        "saving the module",
      );
    }
    if (components)
      await syncComponents(id, before.components, after.components);
    if ("currentSprintId" in patch) {
      await ok(
        api.PATCH("/modules/{moduleId}/current-sprint", {
          params: { path: { moduleId: id } },
          body: { currentSprintId: currentSprintId ?? null },
        }),
        "setting the current sprint",
      );
    }
  },
  remove: (id) =>
    trashed(
      api.DELETE("/modules/{moduleId}", { params: { path: { moduleId: id } } }),
      "deleting the module",
    ),
};

export const members: Persister<Member> = {
  add: (m) => ok(api.POST("/members", { body: m }), "creating the member"),
  update: (id, patch) =>
    ok(
      api.PATCH("/members/{memberId}", {
        params: { path: { memberId: id } },
        body: patch,
      }),
      "saving the member",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/members/{memberId}", { params: { path: { memberId: id } } }),
      "deleting the member",
    ),
};

export const backlog: Persister<BacklogItem> = {
  add: (b) =>
    ok(
      api.POST("/modules/{moduleId}/backlog", {
        params: { path: { moduleId: b.moduleId } },
        body: { ...b, componentId: orUndef(b.componentId) },
      }),
      "creating the backlog item",
    ),
  update: (id, patch) =>
    ok(
      api.PATCH("/backlog/{itemId}", {
        params: { path: { itemId: id } },
        body: { ...patch, componentId: blank(patch.componentId) },
      }),
      "saving the backlog item",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/backlog/{itemId}", { params: { path: { itemId: id } } }),
      "deleting the backlog item",
    ),
};

// ---------------------------------------------------------------- sprints ---

async function syncSprintMembers(
  sprintId: string,
  prev: Sprint["members"],
  next: Sprint["members"],
) {
  const { removed } = diffIds(
    prev.map((m) => m.memberId),
    next.map((m) => m.memberId),
  );
  for (const memberId of removed) {
    await ok(
      api.DELETE("/sprints/{sprintId}/members/{memberId}", {
        params: { path: { sprintId, memberId } },
      }),
      "removing the sprint member",
    );
  }
  for (const m of next) {
    const was = prev.find((p) => p.memberId === m.memberId);
    if (
      was &&
      was.allocation === m.allocation &&
      was.capacityDays === m.capacityDays
    )
      continue;
    await ok(
      api.PUT("/sprints/{sprintId}/members/{memberId}", {
        params: { path: { sprintId, memberId: m.memberId } },
        body: { allocation: m.allocation, capacityDays: m.capacityDays },
      }),
      "adding the sprint member",
    );
  }
}

async function syncSprintBacklog(
  sprintId: string,
  prev: string[],
  next: string[],
) {
  const { added, removed } = diffIds(prev, next);
  for (const itemId of removed) {
    await ok(
      api.DELETE("/sprints/{sprintId}/backlog/{itemId}", {
        params: { path: { sprintId, itemId } },
      }),
      "removing the backlog item from the sprint",
    );
  }
  for (const [position, itemId] of next.entries()) {
    if (!added.includes(itemId)) continue;
    await ok(
      api.PUT("/sprints/{sprintId}/backlog/{itemId}", {
        params: { path: { sprintId, itemId } },
        body: { position },
      }),
      "adding the backlog item to the sprint",
    );
  }
}

function sprintBody(s: Partial<Sprint>) {
  return {
    componentId: blank(s.componentId),
    number: s.number,
    name: s.name,
    goal: s.goal,
    startDate: blank(s.startDate),
    endDate: blank(s.endDate),
    workingDays: s.workingDays,
    daysLeft: s.daysLeft,
    status: s.status,
    committed: s.committed,
    completed: s.completed,
    progress: s.progress,
    risk: s.risk,
  };
}

export const sprints: Persister<Sprint> = {
  add: async (s) => {
    await ok(
      api.POST("/modules/{moduleId}/sprints", {
        params: { path: { moduleId: s.moduleId } },
        body: {
          id: s.id,
          componentId: orUndef(s.componentId),
          number: s.number,
          name: s.name,
          goal: s.goal,
          startDate: orUndef(s.startDate),
          endDate: orUndef(s.endDate),
          workingDays: s.workingDays,
          daysLeft: s.daysLeft,
          status: s.status,
          committed: s.committed,
          completed: s.completed,
          progress: s.progress,
          risk: s.risk,
        },
      }),
      "creating the sprint",
    );
    await syncSprintMembers(s.id, [], s.members);
    await syncSprintBacklog(s.id, [], s.backlogItemIds);
  },
  update: async (id, patch, before, after) => {
    const { members: m, backlogItemIds: b, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      await ok(
        api.PATCH("/sprints/{sprintId}", {
          params: { path: { sprintId: id } },
          body: sprintBody(rest),
        }),
        "saving the sprint",
      );
    }
    if (m) await syncSprintMembers(id, before.members, after.members);
    if (b)
      await syncSprintBacklog(id, before.backlogItemIds, after.backlogItemIds);
  },
  remove: (id) =>
    ok(
      api.DELETE("/sprints/{sprintId}", { params: { path: { sprintId: id } } }),
      "deleting the sprint",
    ),
};

// ------------------------------------------------------------------ tasks ---

async function syncDod(taskId: string, prev: Task["dod"], next: Task["dod"]) {
  for (const [position, d] of next.entries()) {
    const was = prev[position];
    if (was && was.label === d.label && was.done === d.done) continue;
    await ok(
      api.PUT("/tasks/{taskId}/dod", {
        params: { path: { taskId } },
        body: { position, label: d.label, done: d.done },
      }),
      "saving the checklist",
    );
  }
  for (let position = next.length; position < prev.length; position++) {
    await ok(
      api.DELETE("/tasks/{taskId}/dod/{position}", {
        params: { path: { taskId, position } },
      }),
      "trimming the checklist",
    );
  }
}

/** For tasks the API reads "" as "clear it", so an unassign gets through. */
function taskBody(t: Partial<Task>) {
  return {
    title: t.title,
    componentName: t.componentName,
    assigneeId: t.assigneeId,
    estimate: t.estimate,
    boardColumn: t.column,
    priority: t.priority,
    dueDate: t.dueDate,
    blockers: t.blockers,
    offGoal: t.offGoal,
  };
}

export const tasks: Persister<Task> = {
  add: async (t) => {
    await ok(
      api.POST("/sprints/{sprintId}/tasks", {
        params: { path: { sprintId: t.sprintId } },
        body: {
          id: t.id,
          backlogItemId: t.backlogItemId,
          title: t.title,
          componentName: t.componentName,
          assigneeId: orUndef(t.assigneeId),
          estimate: t.estimate,
          boardColumn: t.column,
          priority: t.priority,
          dueDate: orUndef(t.dueDate),
          blockers: t.blockers,
          offGoal: t.offGoal ?? false,
        },
      }),
      "creating the task",
    );
    await syncDod(t.id, [], t.dod);
  },
  update: async (id, patch, before, after) => {
    const { dod, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      await ok(
        api.PATCH("/tasks/{taskId}", {
          params: { path: { taskId: id } },
          body: taskBody(rest),
        }),
        "saving the task",
      );
    }
    if (dod) await syncDod(id, before.dod, after.dod);
  },
  remove: (id) =>
    ok(
      api.DELETE("/tasks/{taskId}", { params: { path: { taskId: id } } }),
      "deleting the task",
    ),
};

/** The board's drag: one call, the column alone. */
export const moveTask = (taskId: string, column: Task["column"]) =>
  ok(
    api.PATCH("/tasks/{taskId}/column", {
      params: { path: { taskId } },
      body: { boardColumn: column },
    }),
    "moving the task",
  );

export const toggleDod = (taskId: string, position: number) =>
  ok(
    api.PATCH("/tasks/{taskId}/dod/{position}", {
      params: { path: { taskId, position } },
    }),
    "ticking the checklist",
  );

// -------------------------------------------------------------- decisions ---

export const decisions: Persister<Decision> = {
  add: (d) =>
    ok(
      api.POST("/modules/{moduleId}/decisions", {
        params: { path: { moduleId: d.moduleId } },
        body: {
          id: d.id,
          decidedOn: d.date,
          title: d.title,
          detail: d.detail,
          owner: d.owner,
          status: d.status,
        },
      }),
      "recording the decision",
    ),
  update: (id, patch) =>
    ok(
      api.PATCH("/decisions/{decisionId}", {
        params: { path: { decisionId: id } },
        body: {
          decidedOn: patch.date,
          title: patch.title,
          detail: patch.detail,
          owner: patch.owner,
          status: patch.status,
        },
      }),
      "saving the decision",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/decisions/{decisionId}", {
        params: { path: { decisionId: id } },
      }),
      "deleting the decision",
    ),
};

// ---------------------------------------------------------------- reviews ---

export const retroNotes: Persister<RetroNote> = {
  add: (n) => ok(api.POST("/retro-notes", { body: n }), "adding the note"),
  update: (id, patch) =>
    ok(
      api.PATCH("/retro-notes/{id}", { params: { path: { id } }, body: patch }),
      "saving the note",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/retro-notes/{id}", { params: { path: { id } } }),
      "deleting the note",
    ),
};

export const retroActions: Persister<RetroAction> = {
  add: (a) =>
    ok(
      api.POST("/retro-actions", {
        body: { ...a, ownerId: orUndef(a.ownerId), due: orUndef(a.due) },
      }),
      "adding the action",
    ),
  update: (id, patch) =>
    ok(
      api.PATCH("/retro-actions/{id}", {
        params: { path: { id } },
        body: {
          ...patch,
          ownerId: blank(patch.ownerId),
          due: blank(patch.due),
        },
      }),
      "saving the action",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/retro-actions/{id}", { params: { path: { id } } }),
      "deleting the action",
    ),
};

export const demoItems: Persister<DemoItem> = {
  add: (d) => ok(api.POST("/demo-items", { body: d }), "adding the demo item"),
  update: (id, patch) =>
    ok(
      api.PATCH("/demo-items/{id}", { params: { path: { id } }, body: patch }),
      "saving the demo item",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/demo-items/{id}", { params: { path: { id } } }),
      "deleting the demo item",
    ),
};

export const clientFeedback: Persister<ClientFeedback> = {
  add: (f) =>
    ok(api.POST("/client-feedback", { body: f }), "adding the feedback"),
  update: (id, patch) =>
    ok(
      api.PATCH("/client-feedback/{id}", {
        params: { path: { id } },
        body: patch,
      }),
      "saving the feedback",
    ),
  remove: (id) =>
    ok(
      api.DELETE("/client-feedback/{id}", { params: { path: { id } } }),
      "deleting the feedback",
    ),
};

// ---------------------------------------------------------------- reports ---

const upsertTemplate = (t: ReportTemplateDef) =>
  ok(api.PUT("/report-templates", { body: t }), "saving the template");

export const reportTemplates: Persister<ReportTemplateDef> = {
  add: upsertTemplate,
  update: (_id, _patch, _before, after) => upsertTemplate(after),
  remove: (id) =>
    ok(
      api.DELETE("/report-templates/{id}", { params: { path: { id } } }),
      "deleting the template",
    ),
};

export const reportQueue: Persister<QueuedReport> = {
  add: (q) =>
    ok(
      api.POST("/report-queue", { body: { ...q, due: orUndef(q.due) } }),
      "queueing the report",
    ),
  update: (id, patch) =>
    patch.status
      ? ok(
          api.PATCH("/report-queue/{id}", {
            params: { path: { id } },
            body: { status: patch.status },
          }),
          "saving the queue item",
        )
      : Promise.resolve(),
  remove: (id) =>
    ok(
      api.DELETE("/report-queue/{id}", { params: { path: { id } } }),
      "removing the queue item",
    ),
};

export const saveGeneratedReport = (r: GeneratedReport) =>
  ok(
    api.POST("/generated-reports", {
      body: {
        id: r.id,
        moduleId: r.moduleId,
        type: r.config.type,
        template: r.config.template,
        period: r.config.period,
        generatedOn: r.date,
        status: r.status,
      },
    }),
    "saving the report",
  );

export const markReportSent = (id: string) =>
  ok(
    api.PATCH("/generated-reports/{id}/sent", { params: { path: { id } } }),
    "marking the report sent",
  );

// --------------------------------------------------------------- settings ---

export const saveRole = (r: RoleDef) =>
  ok(
    api.PUT("/roles", {
      body: { id: r.id, label: r.name, permissions: r.permissions },
    }),
    "saving the role",
  );

export const saveSettings = (
  conf: typeof workspaceDefaults,
  dodTemplate: string[],
) => {
  const { name, ...settings } = conf;
  return ok(
    api.PUT("/settings", { body: { name, settings, dodTemplate } }),
    "saving the settings",
  );
};

export const addMasterValue = (key: string, value: string, position: number) =>
  ok(
    api.POST("/lists/{key}", {
      params: { path: { key } },
      body: { value, position },
    }),
    "adding the value",
  );

export const renameMasterValue = (
  key: string,
  oldValue: string,
  value: string,
) =>
  ok(
    api.PATCH("/lists/{key}/{value}", {
      params: { path: { key, value: oldValue } },
      body: { value },
    }),
    "renaming the value",
  );

export const removeMasterValue = (key: string, value: string) =>
  ok(
    api.DELETE("/lists/{key}/{value}", { params: { path: { key, value } } }),
    "removing the value",
  );

// ----------------------------------------------------------------- logins ---

export interface Login {
  memberId: string | null;
  email: string;
}

/** Every account, so the Members page can tell who can sign in. Admin only. */
export async function listLogins(): Promise<Login[]> {
  const { data, error, response } = await api.GET("/users", {
    params: { query: { limit: 1000 } },
  });
  if (error || !response.ok || !data)
    throw apiError(error, "loading accounts failed");
  return data.map((u) => ({
    memberId: u.memberId ?? null,
    email: u.email ?? "",
  }));
}

/** An admin creates the login a member signs in with. The password is shown once. */
export const createLogin = (body: {
  email: string;
  name: string;
  password: string;
  role: string;
  memberId: string;
}) => ok(api.POST("/users", { body }), "creating the login");

/** Put a deleted subtree back from the trash, in one server-side transaction. */
export const restoreTrash = (trashId: string) =>
  ok(
    api.POST("/trash/{trashId}/restore", { params: { path: { trashId } } }),
    "restoring",
  );
