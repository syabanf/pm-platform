"use client";

import { use, useState } from "react";
import { AIBadge } from "@/components/AICoachPanel";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui";
import { usePrototype, useSprint } from "@/lib/store";

const steps = [
  "Sprint Goal",
  "Sprint Members",
  "Capacity",
  "Select Backlog",
  "AI Risk Check",
  "Commit",
];

export default function SprintPlanningPage({
  params,
}: {
  params: Promise<{ productId: string; sprintId: string }>;
}) {
  const { productId, sprintId } = use(params);
  const sprint = useSprint(sprintId);
  const { backlog, members, showToast, commitSprint, committedSprint } =
    usePrototype();
  const backlogItems = backlog.filter((b) => b.productId === productId);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(sprint?.goal ?? "");
  const [selectedMembers, setSelectedMembers] = useState<string[]>(
    sprint?.members.map((m) => m.memberId) ?? []
  );
  const [selectedBacklog, setSelectedBacklog] = useState<string[]>(
    backlogItems.filter((b) => b.readiness === "ready").map((b) => b.id)
  );

  if (!sprint) return null;

  const workingDays = sprint.workingDays;
  const capacity = members
    .filter((m) => selectedMembers.includes(m.id))
    .reduce((sum, m) => sum + (workingDays * m.allocation) / 100, 0);
  const selectedWork = backlogItems
    .filter((b) => selectedBacklog.includes(b.id))
    .reduce((sum, b) => sum + b.estimate, 0);
  const overcommit = selectedWork - capacity;

  const toggleMember = (id: string) =>
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  const toggleBacklog = (id: string) =>
    setSelectedBacklog((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );

  const canNext =
    (step !== 0 || goal.trim().length > 0) &&
    (step !== 1 || selectedMembers.length > 0);

  return (
    <div className="grid gap-10 md:grid-cols-[200px_1fr] lg:grid-cols-[220px_1fr]">
      {/* Stepper rail: horizontal chips on phone, vertical rail from tablet up */}
      <ol className="flex gap-1 overflow-x-auto pb-1 md:block md:pb-0">
        {steps.map((label, i) => (
          <li key={label} className="shrink-0 md:shrink">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-left text-sm transition-colors md:w-full md:gap-3 md:border-b-0 md:border-l-2 md:py-3 md:pl-4 ${
                i === step
                  ? "border-black font-semibold text-ink"
                  : i < step
                    ? "border-line text-muted hover:text-ink"
                    : "border-line text-line"
              }`}
            >
              <span className="text-xs tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      {/* Step content */}
      <div>
        {step === 0 && (
          <section>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Define the Sprint Goal
            </h3>
            <p className="mt-1 text-sm text-muted">
              Why is this sprint valuable? One clear sentence.
            </p>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="mt-6 w-full max-w-xl border border-line p-4 text-sm text-ink focus:border-black focus:outline-none"
              placeholder="Define a Sprint Goal before selecting backlog items."
            />
            {goal.trim().length === 0 && (
              <p className="mt-2 text-xs text-warning">
                Define a Sprint Goal before selecting backlog items.
              </p>
            )}
          </section>
        )}

        {step === 1 && (
          <section>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Select Sprint Members
            </h3>
            <p className="mt-1 text-sm text-muted">
              Only members active in this sprint count toward capacity.
            </p>
            <ul className="mt-6 max-w-xl divide-y divide-line border-y border-line">
              {members.map((member) => (
                <li key={member.id}>
                  <label className="flex cursor-pointer items-center gap-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="h-4 w-4 accent-black"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink">
                        {member.name}
                      </div>
                      <div className="text-xs text-muted">{member.roleLabel}</div>
                    </div>
                    <span className="text-sm tabular-nums text-muted">
                      {member.allocation}% ={" "}
                      {((workingDays * member.allocation) / 100).toFixed(1)}{" "}
                      pts
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 2 && (
          <section>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Check Capacity
            </h3>
            <p className="mt-1 text-sm text-muted">
              Member Capacity = Working Days × Allocation % · 1 pt ≈ 1 manday
            </p>
            <div className="mt-8 border border-line p-8 text-center max-w-xl">
              <div className="text-6xl font-semibold tabular-nums tracking-tight text-ink">
                {capacity.toFixed(1)}
              </div>
              <div className="label mt-2">
                Total Sprint Capacity (pts) — {workingDays} working days,{" "}
                {selectedMembers.length} members
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Select Backlog
            </h3>
            <div className="mt-1 flex max-w-xl items-center justify-between">
              <p className="text-sm text-muted">
                Items marked ready are pre-selected.
              </p>
              <span
                className={`text-sm font-medium tabular-nums ${
                  selectedWork > capacity ? "text-danger" : "text-ink"
                }`}
              >
                {selectedWork} / {capacity.toFixed(1)} pts
              </span>
            </div>
            <ul className="mt-6 max-w-xl divide-y divide-line border-y border-line">
              {backlogItems.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedBacklog.includes(item.id)}
                      onChange={() => toggleBacklog(item.id)}
                      className="h-4 w-4 accent-black"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ink">
                        {item.title}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <StatusPill status={item.readiness} />
                        {item.readiness !== "ready" && (
                          <span className="text-xs text-warning">
                            This item needs clearer acceptance criteria before
                            sprint planning.
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm tabular-nums text-muted">
                      {item.estimate > 0 ? `${item.estimate} pts` : "—"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {step === 4 && (
          <section>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              AI Risk Check
            </h3>
            <div className="mt-6 max-w-xl border border-line border-l-2 border-l-ai p-6">
              <AIBadge />
              {overcommit > 0 ? (
                <>
                  <p className="mt-3 text-sm font-medium text-ink">
                    Risk: Overcommit by {overcommit.toFixed(1)} pts.
                  </p>
                  <div className="mt-3">
                    <div className="label">Why</div>
                    <p className="mt-1 text-sm text-muted">
                      Selected backlog ({selectedWork} pts) exceeds available
                      capacity ({capacity.toFixed(1)} pts). This sprint may
                      be too heavy for the selected team capacity.
                    </p>
                  </div>
                  <div className="mt-3">
                    <div className="label">Recommendation</div>
                    <ul className="mt-1 space-y-1 text-sm text-ink">
                      <li>— Move low-priority backlog items to next sprint</li>
                      <li>— Reduce scope</li>
                      <li>— Add backend support</li>
                    </ul>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm font-medium text-ink">
                    Commitment looks realistic.
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Selected work ({selectedWork} pts) fits within available
                    capacity ({capacity.toFixed(1)} pts).
                  </p>
                </>
              )}
            </div>
          </section>
        )}

        {step === 5 && (
          <section>
            <h3 className="text-xl font-semibold tracking-tight text-ink">
              Commit Sprint
            </h3>
            <div className="mt-6 max-w-xl space-y-4 border border-line p-6">
              <div>
                <div className="label">Sprint Goal</div>
                <p className="mt-1 text-sm text-ink">{goal}</p>
              </div>
              <div className="grid grid-cols-3 gap-4 border-t border-line pt-4">
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {selectedMembers.length}
                  </div>
                  <div className="label mt-0.5">Members</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold tabular-nums">
                    {capacity.toFixed(1)}
                  </div>
                  <div className="label mt-0.5">Capacity</div>
                </div>
                <div>
                  <div
                    className={`text-2xl font-semibold tabular-nums ${overcommit > 0 ? "text-danger" : "text-success"}`}
                  >
                    {selectedWork}
                  </div>
                  <div className="label mt-0.5">Committed</div>
                </div>
              </div>
              {overcommit > 0 && (
                <p className="border-t border-line pt-4 text-xs text-danger">
                  This sprint may be too heavy for the selected team capacity.
                </p>
              )}
            </div>
            {committedSprint && (
              <p className="mt-4 text-sm text-success">
                Sprint committed. The team can start executing from the Board.
              </p>
            )}
          </section>
        )}

        {/* Wizard actions */}
        <div className="mt-10 flex gap-3 border-t border-line pt-6">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          {step < steps.length - 1 && (
            <Button
              onClick={() => canNext && setStep(step + 1)}
              disabled={!canNext}
            >
              Continue
            </Button>
          )}
          {step === steps.length - 1 && (
            <>
              {overcommit > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setStep(3);
                    showToast(
                      "Deselect low-priority items to fit capacity.",
                      "info"
                    );
                  }}
                >
                  Reduce Scope
                </Button>
              )}
              <Button
                onClick={() => {
                  commitSprint({
                    goal,
                    memberIds: selectedMembers,
                    backlogIds: selectedBacklog,
                  });
                  showToast(
                    overcommit > 0
                      ? "Sprint committed above capacity. Overcommit logged as a sprint risk."
                      : "Sprint committed. Good luck, team.",
                    overcommit > 0 ? "warning" : "success"
                  );
                }}
              >
                {overcommit > 0 ? "Commit Anyway" : "Commit Sprint"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => showToast("Draft saved.", "info")}
              >
                Save Draft
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
