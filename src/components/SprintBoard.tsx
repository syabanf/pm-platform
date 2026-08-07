"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { BacklogItem, BoardColumn, Task } from "@/lib/types";
import { ConfirmButton } from "@/components/ConfirmButton";
import { blockerSeverity, newId, usePrototype } from "@/lib/store";

const columns: { id: BoardColumn; label: string }[] = [
  { id: "selected", label: "Selected" },
  { id: "ready", label: "Ready" },
  { id: "in-progress", label: "In Progress" },
  { id: "in-review", label: "In Review" },
  { id: "qa", label: "QA" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

const LANE_W = "w-64";
const CELL_W = "w-48";

function TaskCardView({
  task,
  expanded,
  onToggleExpand,
  dragging = false,
}: {
  task: Task;
  expanded?: boolean;
  onToggleExpand?: () => void;
  dragging?: boolean;
}) {
  const { toggleDod, tasksCrud, members, moveTask, showToast } = usePrototype();
  const member = members.find((m) => m.id === task.assigneeId);
  const dodDone = task.dod.filter((d) => d.done).length;
  const severity = blockerSeverity(task);

  // The card carries how stuck it is, so a board scanned from across a room
  // still says which cards to ask about first.
  const skin =
    severity === "high"
      ? "border-danger border-l-4 bg-danger/10"
      : severity === "medium"
        ? "border-danger border-l-4 bg-danger/5"
        : severity === "low"
          ? "border-danger border-l-2 bg-paper"
          : task.column === "blocked"
            ? "border-danger border-l-2 bg-paper"
            : "border-line bg-paper";

  return (
    <div
      className={`border p-3 text-left ${skin} ${
        dragging ? "opacity-90 shadow-sm" : ""
      }`}
    >
      <div className="text-sm font-medium leading-snug text-ink">
        {task.title}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="tabular-nums">{task.estimate} pts</span>
        <span
          className={
            task.priority === "high" ? "font-medium text-ink" : undefined
          }
        >
          {task.priority}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className="flex h-6 w-6 items-center justify-center bg-soft text-[10px] font-semibold text-ink"
          title={member?.name}
        >
          {member?.name.charAt(0)}
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] tabular-nums ${
              dodDone === task.dod.length ? "text-success" : "text-muted"
            }`}
          >
            DoD {dodDone}/{task.dod.length}
          </span>
          {/* Says what it opens. It used to be labelled "DoD 2/4", which is a
              progress count — nobody guesses that it is also how you edit,
              assign, estimate, unblock or delete the task. */}
          <button
            onClick={onToggleExpand}
            aria-expanded={!!expanded}
            className="border border-line px-1.5 py-0.5 text-[11px] text-muted hover:border-black hover:text-ink"
          >
            {expanded ? "Close" : "Details"}
          </button>
        </div>
      </div>
      {task.blockers.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-danger/30 pt-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-danger">
            {task.blockers.length}{" "}
            {task.blockers.length === 1 ? "blocker" : "blockers"}
          </div>
          {task.blockers.map((b) => (
            <div
              key={b.id}
              className="flex items-start gap-2 text-[11px] leading-tight text-danger"
            >
              <span className="min-w-0 flex-1">
                <span className="font-medium">{b.category}</span>
                {" — "}
                {b.text}
                {b.days != null && b.days >= 2 && (
                  <span className="text-muted"> · {b.days}d</span>
                )}
              </span>
              {/* Clearing happens on the list you are already reading, rather
                  than on a second copy of it inside the panel. */}
              {expanded && (
                <button
                  onClick={() =>
                    tasksCrud.update(task.id, {
                      blockers: task.blockers.filter((x) => x.id !== b.id),
                    })
                  }
                  className="shrink-0 text-muted hover:text-ink"
                  aria-label={`Clear blocker: ${b.text}`}
                >
                  Clear
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {expanded && (
        <div
          className="mt-2 space-y-2 border-t border-line pt-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="label">Definition of Done</div>
          {task.dod.map((item, i) => (
            <label
              key={item.label}
              className="flex cursor-pointer items-center gap-2 text-xs text-ink"
            >
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleDod(task.id, i)}
                className="h-3 w-3 accent-black"
              />
              <span className={item.done ? "text-muted line-through" : ""}>
                {item.label}
              </span>
            </label>
          ))}
          {/* The blockers themselves are listed above, where they are visible
              without opening anything. Only the way to add one lives here. */}
          <div className="label pt-1">Add a blocker</div>
          <AddBlocker task={task} />

          {/* Dragging was the only way to move a card. There is no drag on a
              phone inside a horizontal scroller, and none from a keyboard, so
              for those people the board was read-only. This is the same
              moveTask the drag handler calls, Definition-of-Done gate and all. */}
          <div className="label pt-1">Column</div>
          <label className="block">
            <span className="sr-only">Move task to column</span>
            <select
              value={task.column}
              onChange={(e) => moveTask(task.id, e.target.value as BoardColumn)}
              className="w-full border border-line px-1.5 py-1 text-xs text-ink focus:border-black focus:outline-none"
            >
              {columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div className="label pt-1">Edit task</div>
          <label className="block">
            <span className="sr-only">Task title</span>
            <input
              value={task.title}
              onChange={(e) =>
                tasksCrud.update(task.id, { title: e.target.value })
              }
              className="w-full border border-line px-2 py-1 text-xs text-ink focus:border-black focus:outline-none"
            />
          </label>
          <div className="flex gap-1.5">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Assignee</span>
              <select
                value={task.assigneeId}
                onChange={(e) =>
                  tasksCrud.update(task.id, { assigneeId: e.target.value })
                }
                className="w-full border border-line px-1.5 py-1 text-xs text-ink focus:border-black focus:outline-none"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="shrink-0">
              <span className="sr-only">Estimate in points</span>
              <input
                type="number"
                min={1}
                value={task.estimate}
                onChange={(e) =>
                  tasksCrud.update(task.id, {
                    estimate: Number(e.target.value),
                  })
                }
                className="w-14 border border-line px-1.5 py-1 text-xs tabular-nums text-ink focus:border-black focus:outline-none"
              />
            </label>
          </div>

          {/* Deleting is not an edit — it gets its own line rather than
              sitting a few pixels from the estimate box. */}
          <div className="flex justify-end border-t border-line pt-2">
            <ConfirmButton
              onConfirm={() => {
                tasksCrud.remove(task.id);
                showToast("Task deleted.", "info");
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DraggableTask({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`}
    >
      <TaskCardView
        task={task}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
      />
    </div>
  );
}

function LaneCell({
  laneId,
  column,
  tasks,
}: {
  laneId: string;
  column: BoardColumn;
  tasks: Task[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${laneId}:${column}` });
  return (
    <div
      ref={setNodeRef}
      className={`${CELL_W} shrink-0 border-l border-line p-2 ${
        isOver ? "bg-soft" : ""
      }`}
    >
      <div className="flex min-h-24 flex-col gap-2">
        {tasks.map((task) => (
          <DraggableTask key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

/**
 * Adds a task.
 *
 * A swimlane already knows which backlog item it belongs to and passes `item`.
 * Kanban does not, so it omits it and the form asks — which is what makes this
 * usable from the view the board actually opens on.
 */
function AddTaskForm({
  item,
  sprintId,
  label = "+ Task",
}: {
  item?: BacklogItem;
  sprintId: string;
  label?: string;
}) {
  const { tasksCrud, members, dodTemplate, showToast, sprints, backlog } =
    usePrototype();
  const sprint = sprints.find((s) => s.id === sprintId);
  const choices = item
    ? [item]
    : backlog.filter((b) => sprint?.backlogItemIds.includes(b.id));

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");
  const [itemId, setItemId] = useState(choices[0]?.id ?? "");

  const parent = item ?? choices.find((c) => c.id === itemId);

  const create = () => {
    if (!title.trim() || !parent) return;
    tasksCrud.add({
      id: newId("task"),
      sprintId,
      backlogItemId: parent.id,
      // Due at the end of the sprint it is added to: the last day it could be
      // finished and still count. The board has no field for it, and a task
      // with no date would simply never appear on the calendar.
      dueDate:
        sprints.find((s) => s.id === sprintId)?.endDate ??
        new Date().toISOString().slice(0, 10),
      title: title.trim(),
      moduleName: parent.title,
      assigneeId,
      estimate: 1,
      column: "selected",
      priority: parent.priority,
      blockers: [],
      dod: dodTemplate.map((label) => ({ label, done: false })),
    });
    setTitle("");
    setOpen(false);
    showToast("Task added to Selected.", "success");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 w-full border border-dashed border-line py-1 text-[11px] text-muted hover:border-black hover:text-ink"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5" onPointerDown={(e) => e.stopPropagation()}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="Task title"
        className="w-full border border-line px-2 py-1 text-xs text-ink focus:border-black focus:outline-none"
      />
      {!item && (
        <label className="block">
          <span className="sr-only">Backlog item this task belongs to</span>
          <select
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="w-full border border-line px-1.5 py-1 text-xs text-ink focus:border-black focus:outline-none"
          >
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <select
        value={assigneeId}
        onChange={(e) => setAssigneeId(e.target.value)}
        className="w-full border border-line px-1.5 py-1 text-xs text-ink focus:border-black focus:outline-none"
      >
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <div className="flex gap-1.5">
        <button
          onClick={create}
          className="flex-1 border border-black bg-black py-1 text-[11px] font-medium text-paper hover:bg-ink"
        >
          Add
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex-1 border border-line py-1 text-[11px] text-muted hover:border-black hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Lane({
  item,
  tasks,
  sprintId,
}: {
  item: BacklogItem;
  tasks: Task[];
  sprintId: string;
}) {
  const doneCount = tasks.filter((t) => t.column === "done").length;
  const hasOffGoal = tasks.some((t) => t.offGoal);
  const blocked = tasks.some((t) => t.column === "blocked");

  return (
    <div className="flex border-b border-line">
      {/* Sticky lane header = the sprint backlog item */}
      <div
        className={`${LANE_W} sticky left-0 z-10 shrink-0 border-r border-black bg-paper p-4`}
      >
        <div className="label">Backlog Item</div>
        <div className="mt-1 text-sm font-semibold leading-snug text-ink">
          {item.title}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
          <span className="tabular-nums">{item.estimate} pts</span>
          <span
            className={`tabular-nums ${doneCount === tasks.length && tasks.length > 0 ? "text-success" : ""}`}
          >
            {doneCount}/{tasks.length} tasks done
          </span>
        </div>
        <div className="mt-2 h-1 w-full bg-soft">
          <div
            className={`h-1 ${blocked ? "bg-danger" : "bg-black"}`}
            style={{
              width: `${tasks.length > 0 ? (doneCount / tasks.length) * 100 : 0}%`,
            }}
          />
        </div>
        {hasOffGoal && (
          <div className="mt-2 text-[11px] text-warning">
            Not related to the Sprint Goal.
          </div>
        )}
        <AddTaskForm item={item} sprintId={sprintId} />
      </div>
      {/* Status cells */}
      {columns.map((column) => (
        <LaneCell
          key={column.id}
          laneId={item.id}
          column={column.id}
          tasks={tasks.filter((t) => t.column === column.id)}
        />
      ))}
    </div>
  );
}

/** Classic kanban: 7 status columns, no lanes. Reuses the same DnD + DoD gate. */
export function KanbanBoard({ sprintId }: { sprintId: string }) {
  const { tasks, moveTask, backlog } = usePrototype();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const sprintTasks = tasks.filter((t) => t.sprintId === sprintId);
  const activeTask = sprintTasks.find((t) => t.id === activeId);

  function KanbanColumn({ column }: { column: (typeof columns)[number] }) {
    const { setNodeRef, isOver } = useDroppable({ id: `kanban:${column.id}` });
    const colTasks = sprintTasks.filter((t) => t.column === column.id);
    const points = colTasks.reduce((sum, t) => sum + t.estimate, 0);
    return (
      <div
        ref={setNodeRef}
        className={`flex w-60 shrink-0 flex-col border-t-2 ${
          column.id === "blocked"
            ? "border-t-danger"
            : column.id === "done"
              ? "border-t-success"
              : "border-t-black"
        } ${isOver ? "bg-soft" : ""}`}
      >
        <div className="flex items-baseline justify-between py-3">
          <span className="label">{column.label}</span>
          <span className="text-xs tabular-nums text-muted">
            {colTasks.length} · {points} pts
          </span>
        </div>
        <div className="flex min-h-40 flex-col gap-2">
          {colTasks.map((task) => {
            const parent = backlog.find((b) => b.id === task.backlogItemId);
            return (
              <div key={task.id}>
                <DraggableTask task={task} />
                {parent && (
                  <div className="mt-0.5 truncate pl-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {parent.title}
                  </div>
                )}
              </div>
            );
          })}
          {colTasks.length === 0 && (
            <div className="border border-dashed border-line py-6 text-center text-xs text-muted">
              No items
            </div>
          )}
          {/* Kanban is the view the board opens on, and until now it had no way
              to add a task at all — the only form lived in Swimlanes. */}
          {column.id === "selected" && (
            <AddTaskForm sprintId={sprintId} label="+ Add task" />
          )}
        </div>
      </div>
    );
  }

  return (
    <DndContext
      id="kanban-board-dnd"
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
      onDragEnd={(e: DragEndEvent) => {
        setActiveId(null);
        if (!e.over) return;
        const column = String(e.over.id).replace(/^kanban:/, "") as BoardColumn;
        moveTask(String(e.active.id), column);
      }}
    >
      <div className="flex gap-4 overflow-x-auto pb-6">
        {columns.map((column) => (
          <KanbanColumn key={column.id} column={column} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardView task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}


/**
 * Records one thing standing in a task's way.
 *
 * The category comes from the master list rather than free text, so "waiting on
 * client" is one thing across the board and not five spellings of it; a team
 * that needs another adds it in Settings without touching code.
 */
function AddBlocker({ task }: { task: Task }) {
  const { tasksCrud, masters, moveTask, showToast } = usePrototype();
  const categories = masters.blockerCategories;
  const [category, setCategory] = useState(categories[0] ?? "");
  const [text, setText] = useState("");

  const add = () => {
    if (!text.trim()) return;
    tasksCrud.update(task.id, {
      blockers: [
        ...task.blockers,
        { id: newId("bk"), category, text: text.trim(), days: 0 },
      ],
    });
    setText("");

    // Recording a blocker used to redden the card and nothing else: the board's
    // Blocked counter, the workload flags and the home triage all read the
    // column, so the one person who wrote down why they were stuck was the one
    // person nobody heard. Saying it is now the same act as being it.
    if (task.column !== "blocked" && task.column !== "done") {
      moveTask(task.id, "blocked");
      showToast("Blocker recorded — task moved to Blocked.", "info");
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block">
        <span className="sr-only">Blocker category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-line bg-paper px-2 py-1 text-xs text-ink"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">What is blocking this task</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="What is it waiting on?"
            className="w-full border border-line bg-paper px-2 py-1 text-xs text-ink"
          />
        </label>
        <button
          onClick={add}
          className="shrink-0 border border-line px-2 py-1 text-xs text-muted hover:border-black hover:text-ink"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export function SprintBoard({ sprintId }: { sprintId: string }) {
  const { tasks, moveTask, showToast, sprints, backlog } = usePrototype();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const sprint = sprints.find((s) => s.id === sprintId);
  const sprintTasks = tasks.filter((t) => t.sprintId === sprintId);
  const activeTask = sprintTasks.find((t) => t.id === activeId);
  const lanes = sprint
    ? sprint.backlogItemIds
        .map((id) => backlog.find((b) => b.id === id))
        .filter((b): b is BacklogItem => !!b)
    : [];

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const [laneId, column] = String(over.id).split(":");
    const task = sprintTasks.find((t) => t.id === active.id);
    if (!task) return;
    if (task.backlogItemId !== laneId) {
      showToast(
        "A task belongs to its backlog item — move it across statuses within its lane.",
        "warning"
      );
      return;
    }
    moveTask(String(active.id), column as BoardColumn);
  }

  return (
    <DndContext
      id="sprint-board-dnd"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto border border-line">
        <div className="min-w-max">
          {/* Column header row */}
          <div className="flex border-b border-black bg-paper">
            <div
              className={`${LANE_W} sticky left-0 z-10 shrink-0 border-r border-black bg-paper p-4`}
            >
              <span className="label">Sprint Backlog ↓ / Status →</span>
            </div>
            {columns.map((column) => {
              const colTasks = sprintTasks.filter(
                (t) => t.column === column.id
              );
              const points = colTasks.reduce((sum, t) => sum + t.estimate, 0);
              return (
                <div
                  key={column.id}
                  className={`${CELL_W} shrink-0 border-l border-line p-3 ${
                    column.id === "blocked"
                      ? "border-t-2 border-t-danger"
                      : column.id === "done"
                        ? "border-t-2 border-t-success"
                        : ""
                  }`}
                >
                  <div className="label">{column.label}</div>
                  <div className="mt-0.5 text-xs tabular-nums text-muted">
                    {colTasks.length} · {points} pts
                  </div>
                </div>
              );
            })}
          </div>
          {/* Lanes */}
          {lanes.map((item) => (
            <Lane
              key={item.id}
              item={item}
              sprintId={sprintId}
              tasks={sprintTasks.filter((t) => t.backlogItemId === item.id)}
            />
          ))}
          {lanes.length === 0 && (
            <div className="p-8 text-center text-sm text-muted">
              No backlog items committed to this sprint yet. Commit a sprint
              from Planning.
            </div>
          )}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? <TaskCardView task={activeTask} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
