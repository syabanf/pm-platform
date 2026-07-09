"use client";

import { useEffect, useState } from "react";
import type { AIInsight } from "@/lib/types";
import { Button } from "@/components/ui";
import { usePrototype } from "@/lib/store";

export function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ai">
      <span className="h-1.5 w-1.5 rounded-full bg-ai" />
      AI
    </span>
  );
}

export function AIInsightBlock({
  insight,
  compact = false,
}: {
  insight: AIInsight;
  compact?: boolean;
}) {
  const { showToast } = usePrototype();
  const [dismissed, setDismissed] = useState(false);
  const [showWhy, setShowWhy] = useState(!compact);

  if (dismissed) return null;

  return (
    <div className="border border-line border-l-2 border-l-ai bg-paper p-5">
      <div className="flex items-center justify-between">
        <AIBadge />
        <span className="text-[11px] text-muted uppercase tracking-wide">
          Confidence: {insight.confidence}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-ink">{insight.insight}</p>
      {showWhy && (
        <div className="mt-3">
          <div className="label">Why</div>
          <p className="mt-1 text-sm text-muted">{insight.reason}</p>
        </div>
      )}
      <div className="mt-3">
        <div className="label">Recommendation</div>
        <ul className="mt-1 space-y-1">
          {insight.recommendations.map((rec) => (
            <li key={rec} className="text-sm text-ink">
              — {rec}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            showToast("Recommendation applied to your plan.", "success")
          }
        >
          Apply Recommendation
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDismissed(true)}
        >
          Dismiss
        </Button>
        {compact && !showWhy && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowWhy(true)}
          >
            Ask Why
          </Button>
        )}
      </div>
    </div>
  );
}

export function AICoachSlideOver({ insights }: { insights: AIInsight[] }) {
  const { aiPanelOpen, setAiPanelOpen } = usePrototype();

  useEffect(() => {
    if (!aiPanelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAiPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiPanelOpen, setAiPanelOpen]);

  return (
    <>
      <Button
        size="lg"
        onClick={() => setAiPanelOpen(!aiPanelOpen)}
        className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6"
      >
        <span className="h-2 w-2 rounded-full bg-ai" />
        AI Coach
      </Button>
      {aiPanelOpen && (
        <div
          className="animate-fade fixed inset-0 z-40 bg-black/10"
          onClick={() => setAiPanelOpen(false)}
        />
      )}
      {aiPanelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Coach insights"
          className="animate-slide-in fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-none"
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <div>
              <div className="text-sm font-semibold text-ink">AI Coach</div>
              <div className="text-xs text-muted">
                Insights are recommendations — you decide.
              </div>
            </div>
            <button
              onClick={() => setAiPanelOpen(false)}
              className="text-muted hover:text-ink text-xl leading-none"
              aria-label="Close AI Coach"
            >
              ×
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            {insights.map((insight, i) => (
              <AIInsightBlock key={i} insight={insight} compact />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
