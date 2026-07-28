"use client";

import { usePrototype } from "@/lib/store";

/**
 * The app's transient messages, and the one live region that announces them.
 *
 * The region is always mounted, even with nothing to say. Assistive technology
 * only announces mutations inside a region it was already watching, so creating
 * the element and its text in the same render — which is what returning null
 * until a toast existed did — meant nothing was ever announced: every "saved",
 * every validation refusal, every blocked drag was silent.
 *
 * aria-atomic re-reads the whole message rather than only the changed words, so
 * one toast replacing another is not announced as a diff of the two.
 */
export function Toast() {
  const { toast } = usePrototype();

  const border =
    toast?.tone === "warning"
      ? "border-l-warning"
      : toast?.tone === "success"
        ? "border-l-success"
        : "border-l-black";

  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {toast && (
        <div
          key={toast.id}
          className={`animate-toast fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-line ${border} border-l-2 bg-paper px-5 py-4 text-sm text-ink lg:bottom-6`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
