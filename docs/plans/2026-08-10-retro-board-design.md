# Making the sprint retro and review real

**Date:** 2026-08-10
**Status:** approved

## The problem

`retroData` in `src/lib/data.ts` is a single frozen object. The retro page
renders it as if it were a working board — Went Well, Needs Improvement, and
Retro Actions with owners and due dates — but nothing can be added, edited or
closed. Three consequences, all reachable:

1. Every sprint shows the same retro. Open Sprint 01's retro and you are
   reading Sprint 03's.
2. The home dashboard raises "Overdue action" triage items from
   `retroData.actions`, and there is no way for anyone to resolve them. They
   are permanent.
3. That triage item links to a hardcoded
   `oee-intelligence/sprints/sprint-03/retro`, so an overdue action from any
   sprint sends you to Sprint 03.

The sprint review page has a related but distinct fault: `demoChecklist` and
`clientFeedback` are `useState` seeded from `reviewData`, so ticking a demo
item or capturing client feedback works until you navigate away, and then it
is gone.

## Approaches considered

**A — four flat collections in the store, keyed by `sprintId`.** Chosen. Each
record gets an `id` and a `sprintId` and goes through the `useCollection` +
`Crud<T>` idiom every other entity already uses. The home dashboard's
overdue-action scan stays a flat filter, and delete-with-undo works the way it
does everywhere else.

**B — one `SprintRetro` record per sprint holding nested arrays.** Fewer
collections, but `Crud<T>.update` works by top-level id, so every edit to a
nested item needs bespoke splice logic, and the dashboard has to flatten across
records first. Trades four declarations for special-case editing in many
places.

**C — reuse `Decision` for retro actions.** Superficially similar — title,
owner, open/closed. But a retro action has a due date and belongs to a sprint,
while a decision belongs to a module and has no due date. Forcing one into the
other corrupts both. Rejected.

## Design

### Data model

Four records in `src/lib/types.ts`, all keyed by `sprintId`:

```ts
RetroNote      { id, sprintId, kind: "went-well" | "needs-improvement", text }
RetroAction    { id, sprintId, action, ownerId, due, status: "open" | "done" }
DemoItem       { id, sprintId, label, done }
ClientFeedback { id, sprintId, from, note, disposition }
```

`ownerId` references a member rather than being the free string it is today,
matching how assignees work on the board.

### Store

Four `useCollection` arrays with their CRUDs, exposed from `PrototypeProvider`
alongside the existing collections. No new patterns.

### Seed

Sprints with status `done` get retros; Sprint 03 keeps the content it has
today. Active and newly created sprints start empty and say so, rather than
rendering an empty list that reads as a broken page.

### The AI blocks stay read-only and stay global

Root Cause and Retro Memory are marked as AI output, and making them editable
would blur what the machine produced and what the team wrote — which is the
point of marking them. They also stay one shared pair rather than becoming
per-sprint, because their text is explicitly cross-sprint: *"recurring pattern:
client data readiness has been the top blocker in Sprints 01, 02, and 03."*
That is a module-level observation. Copying it onto each sprint would make it
false.

### UI

- **Went Well / Needs Improvement** — an add box per column, delete per row.
- **Retro Actions** — add a row (action, owner from the member dropdown, due
  date), toggle open ↔ done, delete. The `2/3` counter becomes live.
- **Review page** — demo checklist ticks and captured feedback persist.

### Home dashboard

The overdue-action triage item derives its href from the action's own sprint,
which fixes the hardcoded link.

### Out of scope

Changing a feedback item's `disposition` after it is created. That would be a
new hardcoded taxonomy, and this codebase has just finished moving taxonomies
into managed master lists. If it is wanted, it belongs there, not inlined here.

## How it will be proved

End-to-end tests that attack the reported faults directly:

- add a Went Well note, navigate away and back — it is still there;
- close a retro action — the matching Home triage item disappears;
- tick a demo item, navigate away and back — it is still ticked;
- two different sprints show two different retros.
