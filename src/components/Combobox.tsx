"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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

/** Tallest the option list gets before it scrolls, in px. */
const MAX_LIST_HEIGHT = 240;

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
 * - The listbox is portalled to the body and positioned against the input's
 *   rect. Rendering it in place put a `<ul>` inside that `<label>`, which is
 *   invalid and folded every visible option into the field's accessible name;
 *   and it made the popup a child of whatever scroll container it sat in, so
 *   on the sprint board — whose columns scroll horizontally, which forces
 *   `overflow-y` to `auto` — the options were clipped. A native `<select>`
 *   popup is painted outside the document and has neither problem.
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
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  /**
   * Where to draw the portalled listbox, in viewport coordinates. Exactly one
   * of `top` / `bottom` is set — which one is the flip decision below.
   */
  const [rect, setRect] = useState<{
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);
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
  // Falling back to the raw value, not to blank: removing a master value
  // deliberately leaves existing records holding it, and a field that shows
  // nothing invites you to pick something else and silently reclassify the
  // record.
  const text = query ?? (value === "" ? "" : (selected?.label ?? value));
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
    // Leave the committed label selected. The keydown interception below only
    // covers printable keys, so paste, IME commits and Android soft keyboards
    // would otherwise append to it — "Retail" + a pasted "Banking" filtered for
    // "RetailBanking" and found nothing.
    requestAnimationFrame(() => inputRef.current?.select());
  };

  // Clicking away is a cancel, not a commit: the field falls back to whatever
  // was already selected rather than keeping a half-typed filter on screen.
  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The listbox is portalled, so it is not inside rootRef — clicking an
      // option would otherwise read as clicking away.
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };
    // focusin as well as mousedown: ⌘K opens the command palette and focuses
    // it without ever pressing a mouse button, which left this list floating
    // over the page with no field behind it — and clicking it still committed.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  // Keep the highlighted row in view when arrowing past the visible window.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${listId}-opt-${active}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  const measure = useCallback(() => {
    const box = inputRef.current?.getBoundingClientRect();
    if (!box) return;
    // A fixed-position popup cannot be scrolled into view, so a field near the
    // bottom of the window would open off-screen and be unreachable. Open
    // upwards when there is more room there, and never ask for more height
    // than the side actually has.
    const GAP = 4;
    const below = window.innerHeight - box.bottom - GAP;
    const above = box.top - GAP;
    const flip = below < Math.min(MAX_LIST_HEIGHT, 160) && above > below;
    setRect({
      left: box.left,
      width: box.width,
      maxHeight: Math.max(80, Math.min(MAX_LIST_HEIGHT, flip ? above : below)),
      ...(flip
        ? { bottom: window.innerHeight - box.top + GAP }
        : { top: box.bottom + GAP }),
    });
  }, []);

  // Before paint, so the list never shows up at the previous field's position.
  useLayoutEffect(() => {
    if (open) measure();
  }, [open, measure]);

  // Any ancestor scrolling moves the field out from under the popup, and
  // `capture` is what makes a scroll inside the board's column container count
  // — scroll events do not bubble.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

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
      // Home/End move through the list only while the field shows a committed
      // label. Once the user is typing they belong to the caret, and taking
      // them made a mis-typed query impossible to jump back and correct.
      if (e.key === "Home" || e.key === "End") {
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : Math.max(0, matches.length - 1));
        return;
      }
      // Space opens the list the way it does on a <select>, instead of
      // starting a search for a space character.
      if (e.key === " ") {
        e.preventDefault();
        if (!open) openWith(options.findIndex((o) => o.value === value));
        return;
      }
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
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        role="combobox"
        aria-expanded={open}
        // Only while it exists. The listbox is unmounted when closed, so
        // advertising it the rest of the time is a dangling reference.
        aria-controls={open ? listId : undefined}
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
          const next = e.target.value;
          // While the field still shows a committed label, every insertion
          // path that produces no printable keydown — paste, IME commit,
          // Android soft keyboard, dictation — arrives here with that label
          // still in front of what was inserted. Strip it, so all of them
          // replace the selection the way typing does. Relying on the text
          // staying selected is not enough: the selection does not survive
          // every one of those paths.
          const label = selected?.label ?? "";
          setQuery(
            query === null && label && next.startsWith(label)
              ? next.slice(label.length)
              : next
          );
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
        onClick={(e) => {
          // Same reason as in commit: an insertion that produces no printable
          // keydown must still replace the label rather than extend it.
          if (query === null) e.currentTarget.select();
          if (!open) openWith(options.findIndex((o) => o.value === value));
        }}
        onKeyDown={onKeyDown}
        className={`w-full min-h-11 cursor-default border border-line px-3 py-2 pr-8 text-sm text-ink transition-colors focus:border-black disabled:cursor-not-allowed disabled:text-muted md:min-h-0 ${className ?? ""}`}
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

      {open &&
        rect &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxHeight,
              ...(rect.top !== undefined
                ? { top: rect.top }
                : { bottom: rect.bottom }),
            }}
            className="fixed z-50 overflow-y-auto border border-black bg-paper py-1 shadow-lg"
          >
            {matches.length === 0 && (
              <li role="presentation" className="px-3 py-2 text-sm text-muted">
                No matches.
              </li>
            )}
            {matches.map((option, i) => (
              <li
                key={option.value}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onMouseEnter={() => setActive(i)}
                // Keeps focus in the input so the field never flickers.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(option)}
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
          </ul>,
          document.body
        )}
    </div>
  );
}
