"use client";

import { use } from "react";
import { KanbanBoard, SprintBoard } from "@/components/SprintBoard";
import { WorkloadView } from "@/components/WorkloadView";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import { AICoachSlideOver } from "@/components/AICoachPanel";
import { dailyInsight } from "@/lib/data";
import { usePrototype, useSprint } from "@/lib/store";

export default function SprintBoardPage({
  params,
}: {
  params: Promise<{ sprintId: string }>;
}) {
  const { sprintId } = use(params);
  const sprint = useSprint(sprintId);
  const { tasks, viewPrefs, setViewPref } = usePrototype();
  const view = viewPrefs.board;
  if (!sprint) return null;

  const sprintTasks = tasks.filter((t) => t.sprintId === sprintId);
  const total = sprintTasks.reduce((sum, t) => sum + t.estimate, 0);
  const done = sprintTasks
    .filter((t) => t.column === "done")
    .reduce((sum, t) => sum + t.estimate, 0);
  const blocked = sprintTasks.filter((t) => t.column === "blocked").length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-x-10 gap-y-3 border-b border-line pb-6">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {progress}%
          </div>
          <div className="label mt-0.5">Progress</div>
        </div>
        <div>
          <div
            className={`text-2xl font-semibold capitalize ${
              sprint.risk === "high"
                ? "text-danger"
                : sprint.risk === "low"
                  ? "text-success"
                  : "text-warning"
            }`}
          >
            {sprint.risk}
          </div>
          <div className="label mt-0.5">Risk</div>
        </div>
        <div>
          <div
            className={`text-2xl font-semibold tabular-nums ${blocked > 0 ? "text-danger" : "text-ink"}`}
          >
            {blocked}
          </div>
          <div className="label mt-0.5">Blocked</div>
        </div>
        <div>
          <div className="text-2xl font-semibold tabular-nums text-ink">
            {sprint.daysLeft}
          </div>
          <div className="label mt-0.5">Days Left</div>
        </div>
        <div className="ml-auto self-center">
          <ViewSwitcher
            options={[
              { id: "kanban" as const, label: "Kanban" },
              { id: "swimlanes" as const, label: "Swimlanes" },
              { id: "workload" as const, label: "Workload" },
            ]}
            value={view}
            onChange={(v) => setViewPref("board", v)}
          />
        </div>
      </div>

      {view === "kanban" && <KanbanBoard sprintId={sprintId} />}
      {view === "swimlanes" && <SprintBoard sprintId={sprintId} />}
      {view === "workload" && <WorkloadView sprintId={sprintId} />}
      <AICoachSlideOver insights={[dailyInsight]} />
    </div>
  );
}
