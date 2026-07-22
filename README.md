# WIT Sprint OS

Delivery management for an agency that runs several clients at once: what needs
attention this morning, which module is slipping, and what to tell the client on
Friday.

Work nests five levels deep, biggest to smallest:

```
Client  →  Project  →  Module  →  Component  →  Sprint
```

A **Client** is the company. A **Project** is the outcome they hired you for. A
**Module** is a product or system you build for it. A **Component** is one piece
of that module, and it owns its own **Sprints**.

> **Naming note for contributors.** The code predates those labels and still uses
> the older ones: the UI's "Module" is the `Product` type and the `/products/`
> route, and the UI's "Component" is the `Module` type and the `/modules/` route.
> The backend tables follow the code, not the UI. Nothing is broken — just read
> `product` as "Module" and `module` as "Component".

## Running it

```bash
npm install && npm run dev
```

Then open http://localhost:3000. There is no sign-up: pick a user on the login
screen. First-time visitors get a six-step guide, and the sidebar's **▶ Demo**
button drives the app for you, clicking through a full tour.

Data lives in memory for the session — creating, editing and deleting are all
safe to try, and a reload puts everything back.

```bash
npm run test        # vitest
npm run lint
npm run build
```

## Layout

| Path | What is in it |
| ---- | ------------- |
| `src/app/` | routes (Next.js App Router) |
| `src/components/` | shared UI; `ui.tsx` holds the primitives |
| `src/lib/store.tsx` | the in-memory store every page reads from |
| `src/lib/types.ts` | domain types |
| `src/lib/data.ts` | the seed data the store starts from |
| `backend/` | Go + Postgres REST API — see [backend/README.md](backend/README.md) |

The backend is complete and tested but **not yet wired to the frontend**; the app
still runs entirely on the client-side store.

## Notes

- Works offline and installs as a PWA.
- Phone, tablet and desktop each get their own layout; on touch devices you can
  swipe between tabs and from the left edge to open the menu.
- Keyboard: `⌘K` opens search from anywhere.
