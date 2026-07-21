"use client";

import { forwardRef } from "react";
import { KpiCard } from "@/components/KpiCard";

/* ============================================================================
 * WIT Sprint OS — standardized UI primitives.
 * One source of truth for buttons, form controls, page/section layout,
 * panels, and empty states. Keeps the Swiss language; snaps outliers to it.
 * ==========================================================================*/

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 border font-medium transition-colors disabled:cursor-not-allowed";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border-black bg-black text-paper hover:bg-ink disabled:border-line disabled:bg-line disabled:text-paper",
  secondary: "border-line text-muted hover:border-black hover:text-ink",
  danger: "border-danger text-danger hover:bg-danger hover:text-paper",
  ghost: "border-transparent text-muted hover:text-ink",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-4 py-2.5 text-sm",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className, type, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cx(
        BTN_BASE,
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    />
  );
});

/** Square icon-only button (search / back / drawer). Always give an aria-label. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function IconButton({ className, type, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cx(
        "flex h-9 w-9 items-center justify-center border border-line text-ink transition-colors hover:border-black",
        className
      )}
      {...rest}
    />
  );
});

/* ------------------------------- Form controls ----------------------------- */

// Note: no `focus:outline-none` — the global :focus-visible ring (globals.css)
// provides the keyboard indicator; `focus:border-black` is the visual accent.
export const inputClass =
  "w-full border border-line px-3 py-2 text-sm text-ink transition-colors focus:border-black";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...rest }, ref) {
  return <select ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="label mb-1.5">{label}</div>
      {children}
    </div>
  );
}

/** Toggle / filter / option chip (the active-vs-inactive selectable button). */
export function ToggleButton({
  active,
  size = "sm",
  className,
  type,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean;
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type ?? "button"}
      aria-pressed={active}
      className={cx(
        // Comfortable thumb target on touch screens; the dense desktop size is
        // restored from md up so the Swiss density is unchanged there.
        "border transition-colors min-h-10 md:min-h-0",
        size === "sm" ? "px-3 py-1 text-xs md:px-2" : "px-3 py-2 text-left text-sm",
        active
          ? "border-black font-medium text-ink"
          : "border-line text-muted hover:border-black hover:text-ink",
        className
      )}
      {...rest}
    />
  );
}

/* --------------------------- Page & section layout ------------------------- */

const CONTAINER_MAX = {
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
} as const;

export function PageContainer({
  children,
  max = "6xl",
  className,
}: {
  children: React.ReactNode;
  max?: keyof typeof CONTAINER_MAX;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "mx-auto px-5 py-8 md:px-10 md:py-12",
        CONTAINER_MAX[max],
        className
      )}
    >
      {children}
    </div>
  );
}

/** Top-of-page header: eyebrow label + h1 + optional description and actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div>
      {eyebrow && <div className="label">{eyebrow}</div>}
      <div className={cx("flex items-start justify-between gap-4", eyebrow && "mt-2")}>
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          {title}
        </h1>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {description && (
        <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
      )}
    </div>
  );
}

/** In-page section header: uppercase label + optional description and actions. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="label">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

/* --------------------------------- Surfaces -------------------------------- */

/** Inline create/edit panel (the black-bordered form that animates in). */
export function Panel({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("animate-in border border-black p-5", className)}>
      {title && <div className="label">{title}</div>}
      <div className={cx(title && "mt-4")}>{children}</div>
    </div>
  );
}

/** Empty / placeholder state. `centered` for the big preview-pane variant. */
export function EmptyState({
  children,
  centered = false,
  className,
}: {
  children: React.ReactNode;
  centered?: boolean;
  className?: string;
}) {
  if (centered) {
    return (
      <div
        className={cx(
          "flex h-full min-h-80 items-center justify-center border border-dashed border-line",
          className
        )}
      >
        <p className="max-w-xs text-center text-sm text-muted">{children}</p>
      </div>
    );
  }
  return (
    <div
      className={cx(
        "border border-dashed border-line p-6 text-sm text-muted",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Content card. Default padding p-6; override with `pad`. */
export function Card({
  children,
  pad = "p-6",
  className,
}: {
  children: React.ReactNode;
  pad?: "p-4" | "p-5" | "p-6";
  className?: string;
}) {
  return (
    <div className={cx("border border-line bg-paper", pad, className)}>
      {children}
    </div>
  );
}

/** Hover-revealed row action group (Edit / Delete on table rows). */
export function RowActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
      {children}
    </div>
  );
}

/** KPI strip: the hairline-gridded row of KpiCards. */
/** One filter dimension: a label and a row of mutually exclusive choices. */
export interface FilterGroup {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Include the "All" entry yourself — use allOf() for the common case. */
  options: { value: string; label: string }[];
}

/** Prepends the standard "All" choice to a set of filter options. */
export function allOf(
  options: { value: string; label: string }[]
): { value: string; label: string }[] {
  return [{ value: "all", label: "All" }, ...options];
}

/**
 * The single filter idiom for every table/list in the app: `Label [All][…]`.
 * Groups wrap, so it reads as one row on a wide table and stacks in a narrow
 * sidebar. `summary` is the optional "showing X of Y" affordance on the right.
 */
export function FilterBar({
  groups,
  summary,
  className,
}: {
  groups: FilterGroup[];
  summary?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line pb-4",
        className
      )}
    >
      {groups.map((group) => (
        // Stacked on phones: once chips wrap to several rows a side label
        // floats against their middle, so it sits above instead. Inline from md.
        <div
          key={group.label}
          className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2"
        >
          <span className="label shrink-0">{group.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => (
              <ToggleButton
                key={option.value}
                active={group.value === option.value}
                onClick={() => group.onChange(option.value)}
              >
                {option.label}
              </ToggleButton>
            ))}
          </div>
        </div>
      ))}
      {summary && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted">
          {summary}
        </span>
      )}
    </div>
  );
}

export function KpiStrip({
  items,
  className,
}: {
  items: {
    value: string | number;
    label: string;
    tone?: "neutral" | "success" | "warning" | "danger";
    delta?: string;
  }[];
  className?: string;
}) {
  return (
    <div
      className={cx(
        "grid gap-px border border-line bg-line",
        items.length === 1
          ? "grid-cols-1"
          : items.length === 3
            ? "grid-cols-2 md:grid-cols-3"
            : "grid-cols-2 md:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-paper">
          <KpiCard
            value={item.value}
            label={item.label}
            tone={item.tone}
            delta={item.delta}
          />
        </div>
      ))}
    </div>
  );
}
