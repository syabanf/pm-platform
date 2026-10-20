"use client";

import { forwardRef } from "react";
import { KpiCard } from "@/components/KpiCard";
import { Combobox, optionsFromChildren } from "@/components/Combobox";

/* ============================================================================
 * projectOS — standardized UI primitives.
 * One source of truth for buttons, form controls, page/section layout,
 * panels, and empty states. Keeps the Swiss language; snaps outliers to it.
 * ==========================================================================*/

const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* --------------------------------- Wordmark -------------------------------- */

/**
 * The product lockup, for the surfaces a client sees: exported documents and
 * report previews, and the login screen.
 *
 * It lives here because the same two lines were written out by hand in three
 * places, so a rename meant finding all three — and one of them is what a
 * client receives as a PDF.
 *
 * `normal-case` is not decoration: the `.label` class uppercases, which would
 * render "PROJECTOS" and flatten the capital that carries the name.
 */
export function Wordmark({
  inline = false,
  className,
}: {
  /** Login uses a single row; documents stack the two lines. */
  inline?: boolean;
  className?: string;
}) {
  const name = (
    <span className="text-lg font-bold tracking-tight text-ink">
      projectOS
    </span>
  );
  const company = (
    <span className={cx("label normal-case", inline ? "ml-1" : "mt-0.5 block")}>
      WIT ID
    </span>
  );
  return inline ? (
    <span className={cx("flex items-center gap-2", className)}>
      {name}
      <span className="h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
      {company}
    </span>
  ) : (
    <div className={className}>
      {name}
      {company}
    </div>
  );
}

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

// Every control is a full pill. Primary is the one solid accent on a screen
// region, secondary is the ink surface, and the quiet options sit on white.
const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-accent-strong text-on-ink shadow-glow hover:bg-accent-dark",
  secondary: "bg-card text-ink shadow-card hover:bg-surface",
  danger: "bg-accent-soft text-danger hover:bg-accent-strong hover:text-on-ink",
  ghost: "text-muted hover:bg-surface hover:text-ink",
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-sm",
};

/** Button classes for a Link that should look like a button. */
export const buttonClass = (
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) => cx(BTN_BASE, BTN_VARIANT[variant], BTN_SIZE[size], className);

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
      className={buttonClass(variant, size, cx(fullWidth && "w-full", className))}
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
        "flex h-10 w-10 items-center justify-center rounded-full bg-card text-ink shadow-card transition-colors hover:bg-surface",
        className
      )}
      {...rest}
    />
  );
});

/* ------------------------------- Form controls ----------------------------- */

// The global :focus-visible ring (globals.css) is the keyboard indicator; the
// border darkening is the pointer one. 16px on phones so iOS never zooms.
export const inputClass =
  "w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-base text-ink transition-colors placeholder:text-silver focus:border-ink md:text-sm";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

/**
 * The app's dropdown. Searchable by default — see `Combobox`.
 *
 * It still takes `<option>` children so call sites keep rendering their choices
 * the way they always have, but `onChange` hands over the chosen value directly
 * instead of a change event: there is no `<select>` element underneath for an
 * `e.target` to point at, and a fake one would be a lie the types would carry
 * everywhere.
 */
export function Select({
  value,
  onChange,
  children,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <Combobox
      value={value}
      onChange={onChange}
      options={optionsFromChildren(children)}
      {...rest}
    />
  );
}

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputClass, className)} {...rest} />;
});

/**
 * A labelled form control.
 *
 * The label is a real `<label>` wrapping the control, which is what gives the
 * control its accessible name — it used to be a `<div>`, so every input in the
 * app announced as "edit, blank" and the visible text was read as unrelated
 * prose. Wrapping associates implicitly, so no call site has to invent an id,
 * and clicking the text focuses the control.
 */
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
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
        "rounded-full font-medium transition-colors min-h-10 md:min-h-0",
        size === "sm" ? "px-3.5 py-1.5 text-xs" : "px-4 py-2 text-left text-sm",
        active
          ? "bg-ink text-on-ink"
          : "bg-card text-muted shadow-card hover:bg-surface hover:text-ink",
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
  // "6xl" is the app-wide default; widened so data-dense pages (tables,
  // boards, KPI strips) use more of a large screen instead of a lost column.
  "6xl": "max-w-[88rem]",
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
        "mx-auto px-4 py-6 md:px-6 md:py-8",
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
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {title}
          <span className="text-accent">.</span>
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
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

/* --------------------------------- Surfaces -------------------------------- */

/** Inline create/edit panel: a white card that animates in. */
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
    <div className={cx("animate-in rounded-card bg-card p-5 shadow-card", className)}>
      {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
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
          "flex h-full min-h-80 items-center justify-center rounded-card bg-surface-2",
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
        "rounded-2xl bg-surface-2 p-6 text-sm text-muted",
        className
      )}
    >
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
        "flex flex-wrap items-center gap-x-6 gap-y-3",
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
        "grid gap-3 sm:gap-4",
        items.length === 1
          ? "grid-cols-1"
          : items.length === 3
            ? "grid-cols-2 md:grid-cols-3"
            : "grid-cols-2 md:grid-cols-4",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="rounded-card bg-card shadow-card">
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
