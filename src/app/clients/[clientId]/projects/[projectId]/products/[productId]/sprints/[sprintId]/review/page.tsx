"use client";

import { use, useState } from "react";
import { AIInsightBlock } from "@/components/AICoachPanel";
import { StatusPill } from "@/components/StatusPill";
import { Button, Input } from "@/components/ui";
import { getSprint, reviewData } from "@/lib/data";
import { usePrototype } from "@/lib/store";

export default function SprintReviewPage({
  params,
}: {
  params: Promise<{ sprintId: string }>;
}) {
  const { sprintId } = use(params);
  const sprint = getSprint(sprintId);
  const { tasks, showToast } = usePrototype();
  const [checklist, setChecklist] = useState(reviewData.demoChecklist);
  const [feedback, setFeedback] = useState(reviewData.clientFeedback);
  const [draft, setDraft] = useState("");

  if (!sprint) return null;

  const increment = tasks.filter(
    (t) => t.sprintId === sprintId && t.column === "done"
  );

  const addFeedback = () => {
    if (!draft.trim()) return;
    setFeedback((prev) => [
      ...prev,
      { from: "Client PIC", note: draft.trim(), disposition: "New" },
    ]);
    setDraft("");
    showToast("Feedback captured. Send it to the backlog from refinement.", "success");
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-ink">
            Sprint Review
          </h3>
          <p className="mt-1 text-sm text-muted">
            Demo the increment, collect feedback, adapt the Product Backlog.
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums text-ink">
            {increment.length}
          </div>
          <div className="label mt-0.5">Increment Items</div>
        </div>
      </div>

      <div className="mt-8 grid gap-12 md:grid-cols-2">
        <section>
          <h4 className="label">Demo Checklist</h4>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {checklist.map((item, i) => (
              <li key={item.label}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setChecklist((prev) =>
                        prev.map((c, j) =>
                          j === i ? { ...c, done: !c.done } : c
                        )
                      )
                    }
                    className="h-4 w-4 accent-black"
                  />
                  <span
                    className={`text-sm ${item.done ? "text-muted line-through" : "text-ink"}`}
                  >
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          <h4 className="label mt-10">Increment Summary</h4>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {increment.length === 0 && (
              <li className="py-3 text-sm text-muted">
                Nothing in Done yet — the increment builds up as tasks pass the
                Definition of Done.
              </li>
            )}
            {increment.map((task) => (
              <li key={task.id} className="flex items-center justify-between py-3">
                <span className="text-sm text-ink">{task.title}</span>
                <span className="text-xs tabular-nums text-muted">
                  {task.estimate} pts
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="label">Client Feedback</h4>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {feedback.map((item, i) => (
              <li key={i} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink">{item.note}</p>
                  <StatusPill
                    status={item.disposition === "New" ? "open" : "done"}
                    label={item.disposition}
                  />
                </div>
                <div className="mt-1 text-xs text-muted">— {item.from}</div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addFeedback()}
              placeholder="Capture feedback from the review…"
              className="flex-1"
            />
            <Button onClick={addFeedback}>Add</Button>
          </div>

          <h4 className="label mt-10">AI Review Summary</h4>
          <div className="mt-3">
            <AIInsightBlock insight={reviewData.aiSummary} />
          </div>
        </section>
      </div>
    </div>
  );
}
