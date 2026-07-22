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
  caption?: string;
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

// Plain-English meaning of each level, nested a little further in each time to
// show "boxes inside boxes".
const levels: [string, string, string][] = [
  ["Client", "the company you're working for", "ml-0"],
  ["Project", "the big goal you're helping them reach", "ml-3"],
  ["Module", "the actual product or system you build for it", "ml-6"],
  ["Component", "one piece of that product, like a login screen", "ml-9"],
  ["Sprint", "a short burst of work — about two weeks", "ml-12"],
];

function Levels() {
  return (
    <ul className="space-y-2">
      {levels.map(([name, desc, indent]) => (
        <li key={name} className={`flex items-baseline gap-3 ${indent}`}>
          <span className="w-24 shrink-0 border border-line px-2 py-1 text-center text-xs font-medium text-ink">
            {name}
          </span>
          <span className="text-xs text-muted">{desc}</span>
        </li>
      ))}
    </ul>
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
    eyebrow: "Start here",
    title: "Hi! Here's the 2-minute tour",
    body: "This app keeps all your client work in one place. Picture a set of boxes inside boxes — the biggest is a client, the smallest is one short chunk of work. Here's the whole set:",
    visual: <Levels />,
  },
  {
    eyebrow: "Every morning",
    title: "Home shows what needs you first",
    body: "Each time you open the app, Home floats the things that need you to the top — anything stuck, overdue, or waiting on a decision. Once your work is rolling, clear these first, then carry on with your day.",
    visual: <Pills items={["Stuck", "Overdue", "Someone's overloaded", "Needs a decision"]} />,
  },
  {
    eyebrow: "Getting around",
    title: "Two ways to find anything",
    body: "Slow way: click down the left menu — a client, then its project, then a module, each click one box deeper. Fast way: press ⌘K (the Command key, or Ctrl on Windows) and type a name.",
    visual: <Chain highlight={["Client", "Project", "Module"]} />,
    caption:
      "On a client, project, or module page, the trail across the top takes you back up.",
  },
  {
    eyebrow: "Where the work lives",
    title: "A Module is your home base",
    body: "Open a Module — one box in from the project — and you'll see sections along the top: the to-do list (Backlog), the sprints, reports, and more. A big product is split into smaller pieces called Components, and each Component runs its own sprints.",
    visual: (
      <Pills
        items={["Overview", "Backlog", "Sprints", "Reports", "Components"]}
      />
    ),
  },
  {
    eyebrow: "Doing the work",
    title: "A sprint, start to finish",
    body: "A sprint is the smallest box — one short chunk of work. Plan what goes in, then drag each task across a simple board (To do → Doing → Done) as you make progress. Check in daily, watch the charts, and finish with a Review plus a quick look-back chat — the Retro.",
    visual: (
      <Pills items={["Planning", "Board", "Daily", "Charts", "Review", "Retro"]} />
    ),
  },
  {
    eyebrow: "That's it!",
    title: "You already know enough to start",
    body: "See a + or an Edit button? Use it — adding and editing are safe, and deleting always asks first. Need a client report or meeting notes? The Reports and Documents pages write them for you. Now pick a client and dive in.",
    visual: <Pills items={["Add", "Edit", "Report", "Safe to try", "Quick search (⌘K)"]} />,
    caption: "Want this tour again? It's the “? How to use” button in the menu.",
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
          {s.caption && (
            <p className="mt-4 text-xs text-muted">{s.caption}</p>
          )}
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
