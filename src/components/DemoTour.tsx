"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clientPath, modulePath, productPath, projectPath } from "@/lib/data";
import { usePrototype } from "@/lib/store";
import { Button } from "@/components/ui";

const DWELL = 4200; // ms on each stop

interface DemoStep {
  title: string;
  body: string;
  href: string;
}

/**
 * Builds the tour from whatever is actually in the store, so every stop points
 * at a page that really exists — no hard-coded ids to rot.
 */
function useDemoSteps(): DemoStep[] {
  const { clients, projects, products, sprints } = usePrototype();

  return useMemo(() => {
    const client = clients[0];
    const project = projects.find((p) => p.clientId === client?.id);
    const product = products.find((p) => p.projectId === project?.id);
    const component = product?.modules[0];
    const sprint =
      sprints.find(
        (s) => s.productId === product?.id && s.moduleId === component?.id
      ) ?? sprints.find((s) => s.productId === product?.id);

    const steps: DemoStep[] = [
      {
        title: "Home — what needs you",
        body: "Every morning starts here: work that's stuck, things overdue, and decisions waiting on someone.",
        href: "/",
      },
    ];

    if (client) {
      steps.push({
        title: "Your clients",
        body: "Every company you deliver for, with health and risk at a glance.",
        href: "/clients",
      });
      steps.push({
        title: `Inside ${client.name}`,
        body: "Open a client to see the projects you're running for them.",
        href: clientPath(client.id),
      });
    }
    if (project) {
      steps.push({
        title: project.name,
        body: "A project holds the modules — the products you actually build.",
        href: projectPath(project),
      });
    }
    if (product) {
      const base = productPath(product);
      steps.push({
        title: product.name,
        body: "This is the delivery workspace for one module: its health, velocity and current sprint.",
        href: base,
      });
      steps.push({
        title: "Backlog",
        body: "The to-do list. Items get refined here until they're ready for a sprint.",
        href: `${base}/backlog`,
      });
      steps.push({
        title: "Components",
        body: "A big product is split into smaller pieces. Each one owns its own sprints.",
        href: `${base}/modules`,
      });
      if (component) {
        steps.push({
          title: component.name,
          body: "Open a component to see its sprints and add a new one.",
          href: modulePath(product, component.id),
        });
      }
      if (sprint) {
        steps.push({
          title: "The sprint board",
          body: "Work moves left to right as it progresses — drag a card to change its status.",
          href: `${base}/sprints/${sprint.id}/board`,
        });
        steps.push({
          title: "Charts",
          body: "Burndown against the ideal line, plus velocity across sprints.",
          href: `${base}/sprints/${sprint.id}/burndown`,
        });
      }
      steps.push({
        title: "Reports",
        body: "Generate a client-ready report from the sprint's real data, then export it.",
        href: `${base}/reports`,
      });
    }

    steps.push({
      title: "That's the tour",
      body: "Now go pick a client and try it — creating and editing are safe, and deleting always asks first.",
      href: "/",
    });

    return steps;
  }, [clients, projects, products, sprints]);
}

export function DemoTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const steps = useDemoSteps();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Restart from the top each time the demo is opened.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setI(0);
      setPaused(false);
      setProgress(0);
    }
  }

  const isLast = i >= steps.length - 1;

  // Drive the navigation — this is the "auto-click".
  useEffect(() => {
    if (!open) return;
    const href = steps[i]?.href;
    if (href) router.push(href);
  }, [open, i, steps, router]);

  // Advance on a timer (setState happens in the interval, never in the body).
  useEffect(() => {
    if (!open || paused || isLast) return;
    const started = Date.now();
    const id = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - started) / DWELL) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        setI((n) => Math.min(n + 1, steps.length - 1));
        setProgress(0);
      }
    }, 80);
    return () => clearInterval(id);
  }, [open, paused, i, isLast, steps.length]);

  if (!open || steps.length === 0) return null;

  const step = steps[i];

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-in print-hide fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto w-[calc(100%-2rem)] max-w-lg border border-black bg-paper shadow-sm lg:bottom-6"
    >
      {/* progress for the current stop */}
      <div className="h-0.5 w-full bg-line">
        <div
          className="h-0.5 bg-brand transition-[width] duration-100 ease-linear"
          style={{ width: `${isLast ? 100 : progress}%` }}
        />
      </div>

      <div className="flex items-start gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="label">
            Demo · {i + 1} of {steps.length}
          </div>
          <div className="mt-1 text-sm font-medium text-ink">{step.title}</div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {step.body}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Exit demo"
          className="shrink-0 text-xs text-muted hover:text-ink"
        >
          Exit
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        {!isLast && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Play" : "Pause"}
          </Button>
        )}
        {isLast ? (
          <Button size="sm" onClick={onClose}>
            Finish
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              setProgress(0);
              setI((n) => Math.min(n + 1, steps.length - 1));
            }}
          >
            Next
          </Button>
        )}
        {i > 0 && (
          <button
            onClick={() => {
              setProgress(0);
              setI((n) => Math.max(0, n - 1));
            }}
            className="text-xs text-muted hover:text-ink"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}
