# Learning plan

The goal is to build the system in understandable slices, not to paste a complete codebase. Each phase should leave a runnable, typechecked project and a clear concept learned.

## Phase 0 — foundation (mostly complete)

- Initialize Git/npm, TypeScript, Express, and environment validation.
- Learn `app.ts` versus `server.ts`, middleware order, request IDs, structured logs, error handling.
- Connect Prisma 7 to the learner's local MySQL database.
- Create the initial `User`, `Store`, and `Membership` schema and migration.

## Phase 1 — authentication and account lifecycle (implemented; walkthrough pending)

- Register: normalize email, validate password, hash with Argon2id.
- Login: verify credentials and issue a short-lived access token.
- Authenticate middleware: verify Bearer JWT and identify the user.
- `GET /auth/me`: return a safe public profile.
- Opaque refresh-token rotation and logout/revocation.
- Change password and local password-reset request/completion.
- Local email verification (no actual mail provider in the first pass).
- Per-operation in-memory IP rate limits for auth endpoints.
- Learn hashes versus encryption, token expiry, one-time token use, and generic auth errors.

The schema migration and typecheck have succeeded. Walk through the register/verify/login/refresh/logout/change/reset flows manually before marking this phase fully verified.

## Phase 2 — stores and tenant access

- Create a store and its OWNER membership in one transaction.
- List/read/update/delete stores with ownership rules.
- Load membership from the database and check per-store roles.
- Learn tenant isolation: derive store scope from the path, validate membership, and filter every tenant query by `storeId`.

## Phase 3 — staff and invitations

- List/change/remove/leave memberships with hierarchy checks.
- Create, list, revoke, and accept expiring single-use invites.
- Bind acceptance to the invited email; store only token hashes.
- Learn authorization matrices and IDOR/BOLA prevention.

## Phase 4 — catalog and storefront

- Product CRUD and status; later categories, variants, and image metadata if useful.
- Public storefront by store slug exposes active products only.
- Keep tenant-specific records and all queries scoped.

## Phase 5 — checkout, orders, and coupons

- Validate items/quantities and compute all prices on the server.
- Use database transactions and atomic stock/coupon updates.
- Store order-item price snapshots; add mock payment and legal order-state transitions.
- Add guest order lookup using a high-entropy public token.

## Phase 6 — audit and staff dashboard API

- Audit sensitive membership, store, coupon, and order actions in the same transaction.
- Use a single permission map and test each role against each protected operation.

## Phase 7 — small frontend experience

- Simple customer storefront and store-owner/staff dashboard, after API flows are understandable.
- Keep the first UI small: register/login, store setup, products, and mock checkout.
- Do not add real payment/email integrations in this learning scope.

## Phase 8 — verification and hardening (learning stretch)

- Add unit/integration tests for permissions, auth, tenant isolation, and checkout.
- Review the threat model and create reproducible regression cases.
- Add build/test/dependency scanning CI only after the app and tests exist.
- Docker, deployment, production secrets, PostgreSQL/RLS are optional comparison/stretch topics, not prerequisites.

## Definition of a completed phase

The learner can explain the key code path, the code compiles, a representative happy path works, and the main failure/security cases are understood. A typecheck alone does not mean an endpoint has been exercised.
