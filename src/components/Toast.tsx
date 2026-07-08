"use client";

import { usePrototype } from "@/lib/store";

export function Toast() {
  const { toast } = usePrototype();
  if (!toast) return null;

  const border =
    toast.tone === "warning"
      ? "border-l-warning"
      : toast.tone === "success"
        ? "border-l-success"
        : "border-l-black";

  return (
    <div
      key={toast.id}
      className={`animate-toast fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-line ${border} border-l-2 bg-paper px-5 py-4 text-sm text-ink lg:bottom-6`}
      role="status"
    >
      {toast.message}
    </div>
  );
}
