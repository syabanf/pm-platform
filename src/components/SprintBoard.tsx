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
import { getSprint, sprintBacklogItems } from "@/lib/data";
import { ConfirmButton } from "@/components/ConfirmButton";
import { newId, usePrototype } from "@/lib/store";

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
  const { toggleDod, tasksCrud, members, showToast } = usePrototype();
  const member = members.find((m) => m.id === task.assigneeId);
  const dodDone = task.dod.filter((d) => d.done).length;
  const blocked = task.column === "blocked";

  return (
    <div
      className={`border bg-paper p-3 text-left ${
        blocked ? "border-danger border-l-2" : "border-line"
      } ${dragging ? "opacity-90 shadow-sm" : ""}`}
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
      <div className="mt-2 flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center bg-soft text-[10px] font-semibold text-ink">
          {member?.name.charAt(0)}
        </span>
        <button
          onClick={onToggleExpand}
          className={`text-[11px] tabular-nums ${
            dodDone === task.dod.length ? "text-success" : "text-muted"
          } hover:text-ink`}
        >
          DoD {dodDone}/{task.dod.length}
        </button>
      </div>
      {blocked && task.blockedReason && (
        <div className="mt-2 border-t border-line pt-2 text-[11px] text-danger">
          {task.blockedReason}
          {task.blockedDays != null && task.blockedDays >= 2 && (
            <div className="mt-0.5 font-medium">
              Open for more than {task.blockedDays} days.
            </div>
          )}
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
          <div className="label pt-1">Edit Task</div>
          <input
            value={task.title}
            onChange={(e) => tasksCrud.update(task.id, { title: e.target.value })}
            className="w-full border border-line px-2 py-1 text-xs text-ink focus:border-black focus:outline-none"
          />
          <div className="flex gap-1.5">
            <select
              value={task.assigneeId}
              onChange={(e) =>
                tasksCrud.update(task.id, { assigneeId: e.target.value })
              }
              className="flex-1 border border-line px-1.5 py-1 text-xs text-ink focus:border-black focus:outline-none"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={task.estimate}
              onChange={(e) =>
                tasksCrud.update(task.id, { estimate: Number(e.target.value) })
              }
              className="w-14 border border-line px-1.5 py-1 text-xs tabular-nums text-ink focus:border-black focus:outline-none"
            />
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

function AddTaskForm({
  item,
  sprintId,
}: {
  item: BacklogItem;
  sprintId: string;
}) {
  const { tasksCrud, members, dodTemplate, showToast } = usePrototype();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");

  const create = () => {
    if (!title.trim()) return;
    tasksCrud.add({
      id: newId("task"),
      sprintId,
      backlogItemId: item.id,
      title: title.trim(),
      moduleName: item.title,
      assigneeId,
      estimate: 1,
      column: "selected",
      priority: item.priority,
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
        + Task
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

export function SprintBoard({ sprintId }: { sprintId: string }) {
  const { tasks, moveTask, showToast } = usePrototype();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const sprint = getSprint(sprintId);
  const sprintTasks = tasks.filter((t) => t.sprintId === sprintId);
  const activeTask = sprintTasks.find((t) => t.id === activeId);
  const lanes = sprint ? sprintBacklogItems(sprint) : [];

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
