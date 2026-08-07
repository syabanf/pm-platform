# E2E testing and hardening — design

Approved 2026-08-07. Scope chosen by the owner: **both e2e suites** (Playwright
for the frontend, Go against real Postgres for the backend) and **hardening
including authorization**.

## Where this starts from

- Frontend: 46 vitest unit/component tests, no browser e2e.
- Backend: 4 test functions — spec↔router agreement and password-hash
  serialisation guards. Nothing executes a handler against a database.
- CI: one workflow, builds container images, runs no tests.
- Middleware present: Recover, RequestID, Logger, BodyLimit, request timeout,
  CORS. Absent: security headers, rate limiting, authorization — all 89
  operations are anonymous.
- Login already answers identically for unknown email and wrong password, but
  only the wrong-password path pays for a bcrypt compare, so the two are
  distinguishable by timing.
- Three list queries are unbounded: `ListSprintMembers`,
  `ListSprintBacklogItems`, `ListTasksByBacklogItem`.
- Known open bug: deleting a sprint that is a module's `current_sprint_id`
  can deadlock against module updates (FK `ON DELETE SET NULL` touches the
  module row outside the usual lock order).

## Decisions and why

**Opaque session tokens in Postgres**, not JWT. Login mints a random 256-bit
token and stores its SHA-256 in a `sessions` table; the middleware resolves it
with one indexed query. Logout is a row delete, so revocation is instant; there
is no signing key to manage; and it is the same idiom
`email_verification_tokens` already uses. JWT's one advantage — no DB hit —
buys nothing at this scale and costs key management plus a denylist the moment
revocation is needed.

**RBAC from the roles already seeded.** `roles.permissions` JSON
(admin `all`, lead `write`, member/observer `read`) becomes the policy:

| Tier | Rule |
| --- | --- |
| Public | `/healthz`, `/readyz`, `/docs`, `/openapi.*`, `POST /auth/register`, `/auth/verify`, `/auth/login` |
| Any valid session | every GET |
| `write` or `all` | POST/PATCH/DELETE on domain resources |
| `all` only | user management (`/users*`) |

**Throwaway-schema e2e harness** for the backend: create a schema, set
`search_path`, apply the real migration files, run, drop. Proven to work in
this repo (the rename verification used it); a dedicated database is not an
option because the `wit` role cannot `CREATE DATABASE`. Suite skips when
`TEST_DATABASE_URL` is unset.

**Playwright runs the production build in CI** (`next build && next start`),
and reuses the local dev server when run by hand. Selectors use accessible
roles/labels — no `data-testid` scatter; the a11y work is the foundation.

## What gets built

1. **Auth (backend).** Migration `000006_sessions` (token_hash unique, user_id
   cascade, expires_at; `SESSION_TTL` config, default 168h). Login returns
   `{token, expiresAt, user}` and does a dummy bcrypt compare on the
   unknown-email path; `POST /auth/logout` revokes (operation #90 —
   `TestOpenAPIMatchesRouter` forces the spec to follow). Bearer middleware,
   one query joining sessions→users→roles; expired rows pruned lazily.
2. **Hardening.** Secure headers (nosniff, frame-deny, referrer-policy, HSTS
   in production only); per-IP rate limit with a strict bucket on
   `/auth/login`; the three unbounded queries get limit/offset; DeleteSprint
   locks the owning module first so the `current_sprint_id` cascade follows
   the same lock order as everything else.
3. **Backend e2e** (`backend/e2e`): auth lifecycle, RBAC matrix (anonymous
   401 / member 403 on write / non-admin 403 on `/users`), full hierarchy
   lifecycle, **exact 409 messages** (the runtime guard for the renamed
   constraint literals), cascade including a concurrent
   delete-current-sprint loop that must not deadlock, pagination and
   `X-Has-More`, partial-PATCH semantics.
4. **Frontend e2e** (Playwright, chromium): login→triage, ⌘K palette, sprint
   panel create/edit/delete with the working-days counter, board add-task /
   Details / column move / DoD, blockers add-darken-clear, calendar day
   detail, Settings master-list category appearing in the AddBlocker form,
   mobile viewport smoke.
5. **CI** (`ci.yml`): frontend job (lint, tsc, vitest, Playwright) and backend
   job (postgres:17 service; vet, test, e2e). First time CI runs any tests.

Out of scope, stated plainly: wiring the frontend to the backend. The
prototype login screen is untouched; authorization is proven through the API
e2e suite.

## Order of work, each step gated

1. Design doc committed (this file).
2. Auth backend → `go build`, `go vet`, spec test green.
3. Hardening items → same gates.
4. Backend e2e suite → suite green against local Postgres.
5. Playwright suite → green against local server.
6. CI + docs.
7. Adversarial multi-agent review (security lens on auth bypasses, coverage
   lens on the suites); confirmed findings fixed.
8. Full gates, per-concern commits, push.
