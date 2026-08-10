"use client";

import { Children, isValidElement, useEffect, useId, useRef, useState } from "react";

export type ComboboxOption = { value: string; label: string; disabled?: boolean };

/**
 * Reads `<option>` children into plain options.
 *
 * Call sites render their options as JSX — `{roles.map((r) => <option …>)}` —
 * and keeping that shape means switching a dropdown to this component touches
 * only its `onChange`, not the loop that builds its choices.
 */
export function optionsFromChildren(children: React.ReactNode): ComboboxOption[] {
  const out: ComboboxOption[] = [];
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child) || child.type !== "option") continue;
    const props = child.props as React.OptionHTMLAttributes<HTMLOptionElement> & {
      children?: React.ReactNode;
    };
    const label =
      typeof props.children === "string"
        ? props.children
        : String(props.children ?? props.value ?? "");
    out.push({
      value: String(props.value ?? label),
      label,
      disabled: props.disabled,
    });
  }
  return out;
}

const norm = (s: string) => s.toLowerCase().trim();

/**
 * A dropdown you can type into.
 *
 * Every list in this app grows — clients, members, work items, industries — and
 * a native `<select>` stops being usable somewhere around thirty entries: no
 * filtering, and the browser's own typeahead only matches from the start of the
 * label. This is the editable-combobox pattern instead, so `<select>` behaviour
 * is preserved (keyboard open, arrow to move, Enter to pick, Escape to cancel)
 * with substring filtering on top.
 *
 * Two details worth knowing before editing:
 *
 * - The control is an `<input>`, not a button, so that `<Field>` — which is a
 *   real `<label>` wrapping its child — names it implicitly the same way it
 *   names every other input.
 * - Because the popup renders *inside* that label, a click on an option would
 *   otherwise be forwarded to the input as label activation and immediately
 *   reopen the list. The `preventDefault` on option mousedown/click is what
 *   stops that, and is not incidental styling.
 */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  /** Receives the chosen option's value. Empty string when cleared. */
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  // `null` means "not typing" — the input shows the selected label. A string,
  // including "", means the user is filtering and owns the field's text.
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  // A blank-valued option ("Select industry…", "All") is a prompt, not a
  // choice. Showing its label as the field's *value* makes an untouched field
  // look filled in, so it becomes the placeholder instead — while staying in
  // the list, where it is how you clear a selection.
  const prompt = options.find((o) => o.value === "");
  const text = query ?? (value === "" ? "" : (selected?.label ?? ""));
  const matches =
    query === null || query === ""
      ? options
      : options.filter((o) => norm(o.label).includes(norm(query)));

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const commit = (option: ComboboxOption) => {
    if (option.disabled) return;
    onChange(option.value);
    close();
  };

  // Clicking away is a cancel, not a commit: the field falls back to whatever
  // was already selected rather than keeping a half-typed filter on screen.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open]);

  // Keep the highlighted row in view when arrowing past the visible window.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const openWith = (index: number) => {
    setOpen(true);
    setActive(Math.max(0, index));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // The field shows the committed label until the user types. Taking over
    // that first keystroke is what makes typing *replace* the selection rather
    // than extend it — selecting the text on focus is not enough, because focus
    // never leaves after picking an option, so the next keystroke would land in
    // the middle of "Banking" and filter for something that cannot match.
    if (query === null && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key.length === 1) {
        e.preventDefault();
        setQuery(e.key);
        setOpen(true);
        setActive(0);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        setQuery("");
        setOpen(true);
        setActive(0);
        return;
      }
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        openWith(matches.findIndex((o) => o.value === value));
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : -1;
      if (matches.length > 0) {
        setActive((i) => (i + step + matches.length) % matches.length);
      }
      return;
    }
    if (e.key === "Enter") {
      if (!open) return; // let the surrounding form submit
      e.preventDefault();
      const option = matches[active];
      if (option) commit(option);
      return;
    }
    if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault(); // don't also close a dialog the field sits in
      close();
      return;
    }
    if (e.key === "Tab" && open) close();
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[active] ? `${listId}-opt-${active}` : undefined
        }
        aria-label={ariaLabel}
        autoComplete="off"
        disabled={disabled}
        value={text}
        placeholder={prompt?.label ?? placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={(e) => {
          // Select the current label so it is visibly about to be replaced.
          e.target.select();
          openWith(options.findIndex((o) => o.value === value));
        }}
        // Focus does not fire on a field that already has it, and picking an
        // option leaves focus in place — so without this, clicking the field
        // again to change your mind does nothing at all.
        onClick={() => {
          if (!open) openWith(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={onKeyDown}
        className="w-full cursor-default border border-line px-3 py-2 pr-8 text-sm text-ink transition-colors focus:border-black disabled:cursor-not-allowed disabled:text-muted"
      />
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className={`pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted transition-transform ${
          open ? "rotate-180" : ""
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto border border-black bg-paper py-1 shadow-lg"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">No matches.</li>
          )}
          {matches.map((option, i) => (
            <li
              key={option.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              onMouseEnter={() => setActive(i)}
              // Keeps focus in the input so the field never flickers…
              onMouseDown={(e) => e.preventDefault()}
              // …and stops the enclosing <label> from re-activating the input.
              onClick={(e) => {
                e.preventDefault();
                commit(option);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
                option.disabled
                  ? "cursor-not-allowed text-muted"
                  : i === active
                    ? "bg-soft text-ink"
                    : "text-ink"
              } ${option.value === value ? "font-medium" : ""}`}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
