# Learning plan

The goal is to build the system in understandable slices, not to paste a complete codebase. Each phase should leave a runnable, typechecked project and a clear concept learned.

## Phase 0 — foundation (mostly complete)

- Initialize Git/npm, TypeScript, Express, and environment validation.
- Learn `app.ts` versus `server.ts`, middleware order, request IDs, structured logs, error handling.
- Connect Prisma 7 to the learner's local MySQL database.
- Create the initial `User`, `Store`, and `Membership` schema and migration.

## Phase 1 — authentication and account lifecycle (implemented; core refresh cases tested)

- Register: normalize email, validate password, hash with Argon2id.
- Login: verify credentials and issue a short-lived access token.
- Authenticate middleware: verify Bearer JWT and identify the user.
- `GET /auth/me`: return a safe public profile.
- Opaque refresh-token rotation and logout/revocation.
- HttpOnly refresh cookie, in-memory access token, silent startup restore, cross-tab Web Locks/single-flight, and cross-tab logout broadcast.
- Refresh-token row locking and a 10-second token-free `REFRESH_RETRY` grace response; later replay revokes the token family.
- API wrapper refreshes once on an expired access-token 401 and retries the original request once.
- Change password and local password-reset request/completion.
- Local email verification (no actual mail provider in the first pass).
- Per-operation in-memory IP rate limits for auth endpoints.
- Learn hashes versus encryption, token expiry, one-time token use, and generic auth errors.

The refresh-rotation migration is applied. `npm run typecheck`, the frontend build, and focused MySQL integration tests pass. The tests cover concurrent tab-style refresh, replay inside and after the grace window, logout broadcast/revocation, and API retry. Manually walk through register/verify/login/password change/reset in the UI to verify the remaining account lifecycle screens.

## Phase 2 — stores and tenant access (API implemented; verification remains)

- Create a store and its OWNER membership in one transaction.
- List/read/update/delete stores with ownership rules.
- Load membership from the database and check per-store roles.
- Learn tenant isolation: derive store scope from the path, validate membership, and filter every tenant query by `storeId`.
- Current endpoints are typechecked; exercise ownership and cross-tenant denial manually and add regression coverage.

## Phase 3 — staff and invitations (API implemented; verification remains)

- List/change/remove/leave memberships with hierarchy checks.
- Create, list, revoke, and accept expiring single-use invites.
- Bind acceptance to the invited email; store only token hashes.
- Learn authorization matrices and IDOR/BOLA prevention.

## Phase 4 — catalog and storefront (API implemented; verification remains)

- Product CRUD and status; later categories, variants, and image metadata if useful.
- Public storefront by store slug exposes active products only.
- Keep tenant-specific records and all queries scoped.

## Phase 5 — checkout, orders, and coupons (API implemented; verification remains)

- Validate items/quantities and compute all prices on the server.
- Use database transactions and atomic stock/coupon updates.
- Store order-item price snapshots; add mock payment and legal order-state transitions.
- Add guest order lookup using a high-entropy public token.

## Phase 6 — audit API (implementation in place; permissions need a decision)

- Read the latest tenant-scoped audit events; checkout and order transitions write audit rows.
- The current API allows OWNER/ADMIN to read audit logs; the PRD currently also grants MANAGER/SUPPORT. Resolve this mismatch, then exercise each role against protected operations.

The API feature implementation pass is complete: `npm run typecheck` succeeds and all Prisma migrations are applied to the configured local database. This verifies compile/schema consistency, not every route's runtime behavior; tenant, permission, invitation, and commerce walkthroughs remain. The API state model also currently uses `PROCESSING` and `COMPLETED`, while the PRD describes `DELIVERED`.

## Phase 7 — frontend experience (implemented; runtime walkthrough remains)

- React/Vite customer storefront and store-owner/staff dashboard are present.
- Account screens include register → verify email → sign-in, reset, and password change. Access tokens are in memory; refresh tokens use HttpOnly cookies.
- Direct `/s/:slug` storefront URLs and invitation acceptance from the store selector are implemented.
- `npm --prefix web run build` passes. Walk through the UI against the running API and report contract or usability issues.
- Do not add real payment/email integrations in this learning scope.

## Phase 8 — verification and hardening (next backend learning phase)

- Add unit/integration tests for permissions, auth, tenant isolation, and checkout.
- Review the threat model and create reproducible regression cases.
- First reconcile the PRD/API differences: order states (`DELIVERED` vs `COMPLETED`) and audit-log role access (PRD vs OWNER/ADMIN route policy).
- Make mock payment and its audit event one database transaction; order notes and their audit event are also currently separate writes.
- Walk through role boundaries, two-store isolation, invite expiry/email matching, checkout concurrency, cancellation/refund stock restoration, and failure cases.
- Product and order list APIs currently have no pagination; treat pagination as an optional performance follow-up for this local dataset.
- Add build/test/dependency scanning CI only after the app and tests exist.
- Docker, deployment, production secrets, PostgreSQL/RLS are optional comparison/stretch topics, not prerequisites.

## Definition of a completed phase

The learner can explain the key code path, the code compiles, a representative happy path works, and the main failure/security cases are understood. A typecheck alone does not mean an endpoint has been exercised.
