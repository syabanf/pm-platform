"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clientPath,
  modulePath,
  projectPath,
} from "@/lib/data";
import { usePrototype } from "@/lib/store";

interface PaletteEntry {
  /** Unique per source record, so two same-titled tasks are distinct rows. */
  id: string;
  label: string;
  hint: string;
  group: string;
  path: string;
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { clients, projects, modules, sprints, tasks, backlog, decisions, members } =
    usePrototype();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo<PaletteEntry[]>(() => {
    const list: PaletteEntry[] = [];
    clients.forEach((c) =>
      list.push({
        id: c.id,
        label: c.name,
        hint: c.industry,
        group: "Clients",
        path: clientPath(c.id),
      })
    );
    projects.forEach((p) => {
      const client = clients.find((c) => c.id === p.clientId);
      list.push({
        id: p.id,
        label: p.name,
        hint: client?.name ?? "",
        group: "Projects",
        path: projectPath(p),
      });
    });
    modules.forEach((p) =>
      list.push({
        id: p.id,
        label: p.name,
        hint: "Module",
        group: "Modules",
        path: modulePath(p),
      })
    );
    sprints.forEach((s) => {
      const mod = modules.find((p) => p.id === s.moduleId);
      list.push({
        id: s.id,
        label: `Sprint ${String(s.number).padStart(2, "0")} — ${s.name}`,
        hint: `${mod?.name ?? ""} · Board`,
        group: "Sprints",
        path: mod
          ? `${modulePath(mod)}/sprints/${s.id}/board`
          : "/clients",
      });
    });
    // The palette used to stop at names — a client, a module, a sprint. Search
    // now reaches the content people actually look for by phrase: a task, a
    // backlog item, a decision, a person. Each lands on the board or page that
    // holds it, so finding it is the same as opening it.
    tasks.forEach((t) => {
      const sprint = sprints.find((s) => s.id === t.sprintId);
      const mod = sprint && modules.find((p) => p.id === sprint.moduleId);
      list.push({
        id: t.id,
        label: t.title,
        hint: sprint
          ? `Sprint ${String(sprint.number).padStart(2, "0")} · ${mod?.name ?? ""}`
          : "Task",
        group: "Tasks",
        path: mod
          ? `${modulePath(mod)}/sprints/${t.sprintId}/board`
          : "/clients",
      });
    });
    backlog.forEach((b) => {
      const mod = modules.find((p) => p.id === b.moduleId);
      list.push({
        id: b.id,
        label: b.title,
        hint: mod ? `${mod.name} · Backlog` : "Backlog item",
        group: "Backlog",
        path: mod ? `${modulePath(mod)}/backlog` : "/clients",
      });
    });
    decisions.forEach((d) => {
      const mod = modules.find((p) => p.id === d.moduleId);
      list.push({
        id: d.id,
        label: d.title,
        hint: mod ? `${mod.name} · Decision Log` : "Decision",
        group: "Decisions",
        path: mod ? `${modulePath(mod)}/decisions` : "/clients",
      });
    });
    members.forEach((m) =>
      list.push({
        id: m.id,
        label: m.name,
        hint: m.roleLabel || m.role,
        group: "People",
        path: "/settings/members",
      })
    );
    [
      { label: "MoM Generator", path: "/documents/mom" },
      { label: "Status Update", path: "/documents/status-update" },
      { label: "Change Request", path: "/documents/change-request" },
      { label: "UAT Sign-off", path: "/documents/uat-signoff" },
      { label: "Kickoff Charter", path: "/documents/kickoff" },
    ].forEach((d) =>
      list.push({ ...d, id: d.path, hint: "Generate document", group: "Documents" })
    );
    [
      { label: "Report Queue", path: "/reports" },
      { label: "New Client", path: "/clients" },
      { label: "AI Coach", path: "/ai-coach" },
      { label: "Workspace Settings", path: "/settings" },
      { label: "List Masters", path: "/settings/lists" },
      { label: "Report Templates", path: "/settings/report-templates" },
    ].forEach((a) =>
      list.push({ ...a, id: `action:${a.path}`, hint: "Go to", group: "Actions" })
    );
    return list;
  }, [clients, projects, modules, sprints, tasks, backlog, decisions, members]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries.slice(0, 8);
    return entries
      .filter(
        (e) =>
          e.label.toLowerCase().includes(q) || e.hint.toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [entries, query]);

  // Reset search state when the palette opens (derive-from-prop pattern).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setCursor(0);
    }
  }

  // Keep the cursor on the first result whenever the query changes.
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setCursor(0);
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!open) return null;

  const go = (entry: PaletteEntry) => {
    onClose();
    router.push(entry.path);
  };

  const activeId = results[cursor]
    ? `cmdk-option-${cursor}`
    : undefined;

  return (
    <div
      className="animate-fade fixed inset-0 z-[60] bg-black/20 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette — search and go anywhere"
        className="animate-in mx-auto w-full max-w-lg border border-black bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-listbox"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search clients, modules, sprints, tasks, people and documents"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => Math.min(c + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => Math.max(c - 1, 0));
            }
            if (e.key === "Enter" && results[cursor]) go(results[cursor]);
          }}
          placeholder="Search anything — clients, tasks, people, decisions…"
          className="w-full border-b border-line bg-paper px-4 py-3.5 text-sm text-ink placeholder:text-muted focus:outline-none"
        />
        <div
          id="cmdk-listbox"
          role="listbox"
          aria-label="Results"
          className="max-h-80 overflow-y-auto py-1"
        >
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted">
              Nothing matches &ldquo;{query}&rdquo;.
            </div>
          )}
          {results.map((entry, i) => (
            <button
              key={`${entry.group}:${entry.id}`}
              id={`cmdk-option-${i}`}
              role="option"
              aria-selected={i === cursor}
              onClick={() => go(entry)}
              onMouseEnter={() => setCursor(i)}
              className={`flex w-full items-baseline justify-between gap-3 px-4 py-2.5 text-left ${
                i === cursor ? "bg-soft" : ""
              }`}
            >
              <span className="min-w-0">
                <span
                  className={`block truncate text-sm ${i === cursor ? "font-medium text-black" : "text-ink"}`}
                >
                  {entry.label}
                </span>
                {entry.hint && (
                  <span className="block truncate text-xs text-muted">
                    {entry.hint}
                  </span>
                )}
              </span>
              <span className="label shrink-0">{entry.group}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[10px] uppercase tracking-wide text-muted">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
