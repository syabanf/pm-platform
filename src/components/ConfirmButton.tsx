"use client";

import { useEffect, useRef, useState } from "react";

/** Two-step destructive action: first click arms it, second click confirms. */
export function ConfirmButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm?",
  className = "",
}: {
  onConfirm: () => void;
  label?: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <button
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 3000);
        }
      }}
      className={`border px-2 py-1 text-xs transition-colors ${
        armed
          ? "border-danger bg-danger font-medium text-paper"
          : "border-line text-muted hover:border-danger hover:text-danger"
      } ${className}`}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
