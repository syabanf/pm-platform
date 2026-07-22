"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";

const SEEN_KEY = "wit-howto-seen";

/** Reads/writes the "has seen the guide" flag, SSR-safe (read post-mount). */
export function useHowTo(eligible: boolean) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Auto-open once, only for a signed-in user who has not seen it.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (checked || !eligible) return;
    setChecked(true);
    try {
      if (window.localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
    } catch {
      /* localStorage unavailable — just don't auto-open */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [eligible, checked]);

  return { open, setOpen };
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface Step {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

const chain = ["Client", "Project", "Module", "Component", "Sprint"];

function Chain({ highlight }: { highlight?: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chain.map((c, i) => (
        <span key={c} className="flex items-center gap-1.5">
          <span
            className={`border px-2.5 py-1 text-xs font-medium ${
              highlight?.includes(c)
                ? "border-black bg-black text-paper"
                : "border-line text-muted"
            }`}
          >
            {c}
          </span>
          {i < chain.length - 1 && (
            <span className="text-muted" aria-hidden>
              ›
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((p) => (
        <span
          key={p}
          className="border border-line px-2.5 py-1 text-xs text-muted"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

const steps: Step[] = [
  {
    eyebrow: "Welcome",
    title: "WIT Sprint OS",
    body: "A delivery workspace for consulting teams. Everything lives on one line — from the client all the way down to the sprint.",
    visual: <Chain />,
  },
  {
    eyebrow: "Home",
    title: "Start your day here",
    body: "Home shows what needs you right now — blocked work, overdue actions and open decisions — above live portfolio KPIs and the items you last touched.",
    visual: <Pills items={["Blocked", "Overdue action", "Overloaded", "Decision"]} />,
  },
  {
    eyebrow: "Navigate",
    title: "Drill down, or jump",
    body: "Open a Client, then its Project, then a Module — from the sidebar or the portfolio tree. Breadcrumbs take you back up. Press ⌘K to jump straight to anything.",
    visual: <Chain highlight={["Client", "Project", "Module"]} />,
  },
  {
    eyebrow: "Module",
    title: "The delivery workspace",
    body: "A Module has tabs for Backlog, Sprints, Reports and more. It is split into Components, and each Component owns its own sprints.",
    visual: (
      <Pills
        items={["Overview", "Backlog", "Sprints", "Reports", "Components"]}
      />
    ),
  },
  {
    eyebrow: "Sprint",
    title: "Run a sprint end-to-end",
    body: "Plan the sprint, work the Board, run Daily stand-ups, watch the Charts, then Review and Retro — every stage is a tab on the sprint.",
    visual: (
      <Pills items={["Planning", "Board", "Daily", "Charts", "Review", "Retro"]} />
    ),
  },
  {
    eyebrow: "You're set",
    title: "Create, edit, report",
    body: "Add or edit anything with the inline panels — hover a table row for Edit. Generate client-ready reports and documents from Reports and Documents. Reopen this guide anytime from the sidebar.",
    visual: <Pills items={["Add", "Edit", "Report", "Export", "⌘K"]} />,
  },
];

export function HowToWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  // Reset to the first step each time it opens (derive-from-prop pattern).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setStep(0);
  }

  if (!open) return null;

  const close = () => {
    markSeen();
    onClose();
  };
  const isLast = step === steps.length - 1;
  const s = steps[step];

  return (
    <div
      className="animate-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/25 p-4 sm:items-center"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to use WIT Sprint OS"
        className="animate-in flex w-full max-w-lg flex-col border border-black bg-paper"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") close();
          if (e.key === "ArrowRight" && !isLast) setStep(step + 1);
          if (e.key === "ArrowLeft" && step > 0) setStep(step - 1);
        }}
        tabIndex={-1}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-3">
          <span className="label">
            Guide · {step + 1} of {steps.length}
          </span>
          <button
            onClick={close}
            className="text-xs text-muted hover:text-ink"
            aria-label="Close guide"
          >
            Skip
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-8">
          <div className="label text-brand">{s.eyebrow}</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {s.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          <div className="mt-6">{s.visual}</div>
        </div>

        {/* footer: progress + controls */}
        <div className="flex items-center justify-between border-t border-line px-6 py-4">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === step ? "bg-ink" : "bg-line"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={close}>
                Start using it
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
