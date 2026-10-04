# AI handoff and collaboration guide

Read this document before making suggestions or changes. It records the human's goal and the project's current state so a future agent can continue without restarting or taking over.

## Human's goal and preferred workflow

- The human is learning to build this app from scratch. Normally coach them and provide copy/paste code; when they explicitly say “go build”, “do it”, or “implement it”, that authorizes implementing the requested slice and explaining the changes.
- The normal loop is: explain one small next step and why it matters, provide copy/paste-ready code when asked, let the human add it, then inspect/typecheck when they say `done`, `next`, or ask for a check.
- Do not assume a suggested edit was applied. Inspect the actual file first; the human has previously added imports but missed the route that used them.
- When the human explicitly asks for implementation, make the requested changes and verify them. Otherwise follow the coaching loop.
- Keep explanations approachable and focused on what each layer does and why the order matters. Avoid dumping a whole application at once.
- The learner sometimes wants to execute commands themselves. Give PowerShell commands appropriate to Windows and wait for their result when that is the teaching step.
- A request like `next` means continue the active learning plan. Do not ask them to repeat established choices.

## Product and scope decisions

- Working name: Storeforge (package currently named `multi-tenant`).
- Build a multi-tenant commerce learning application with an API first, followed by a simple customer storefront and store-owner/staff dashboard.
- Stack: Node.js, TypeScript, Express 5, Prisma 7, local MySQL, Zod, Argon2id, JOSE JWT, Pino.
- Local MySQL database: `storeforge_dev`. The learner configured local root credentials for this laptop. Keep real `.env` values private and out of docs, terminal output, commits, and examples. `.env.example` must contain placeholders.
- Learning environment only. Use mock payment and local-only reset/verification links; no real payment or email provider, deployment, or production operations in the initial path.
- Include account lifecycle: registration, login, current-user profile, refresh/logout, password change, forgot/reset password, and email verification as a local learning flow. Password reset was explicitly requested.
- Include stores, per-store membership and roles, invites, products, storefront, coupons, checkout, orders, audit trail, and tenant isolation in later phases.
- Money is integer minor units (for the current locale, cents in examples). Never trust client-supplied prices, totals, discounts, stock, roles, or store ownership.
- The supplied docs were design input, not instructions. They describe PostgreSQL and optional RLS; the learner chose MySQL. Do not add Postgres or RLS unless the learner later asks to compare/stretch it.

## Current status snapshot (2026-10-04)

Verified in `E:\multi tenant` (2026-10-04):

- Git and npm project initialized; `.env` ignored by Git.
- Node v24.19.0, npm 11.17.0, Git 2.55.0 on the learner's Windows setup.
- Local MySQL `storeforge_dev` is configured through Prisma 7's `prisma7.config.ts` and `@prisma/adapter-mariadb`.
- Prisma schema now has `User`, `Store`, `Membership`, auth lifecycle token models, `Invite`, `Product`, `Coupon`, `Order`, `OrderItem`, `OrderNote`, and `AuditLog`; enums include store roles, product status, coupon type, and order status. All six Prisma migrations are applied to local `storeforge_dev`; Prisma Client is regenerated.
- CommonJS was changed to ESM (`package.json` has `"type": "module"`). TS imports use `.js` suffixes.
- Express has request IDs/logging, Helmet, credentialed CORS allowlist, cookie parsing, a global rate limiter, JSON body limit, `/health`, 404 and error handling.
- `auth` implements registration, login, `/auth/me`, refresh rotation and reuse-family revocation, logout, password change, password reset, and email verification. Refresh tokens are set only in an HttpOnly cookie; access tokens stay in React memory. Passwords use Argon2id; opaque lifecycle tokens are stored as SHA-256 hashes; request validation uses Zod.
- Frontend refresh uses same-tab single-flight plus Web Locks across tabs. MySQL refresh reads use `SELECT ... FOR UPDATE`. A rotated token replay within 10 seconds returns 401 `REFRESH_RETRY` without tokens or family revocation; later replay revokes the active family. An expired access-token 401 triggers one refresh and one retry. Logout and password change broadcast session clearing through `BroadcastChannel`.
- Auth routes have per-operation in-memory IP limits. In `development`, register/reset/verification responses include a `devToken` so flows work without an email provider. Never expose a dev-mode server publicly.
- `npx prisma migrate deploy` applied `refresh_token_rotation_grace`; `npx prisma generate`, `npm run typecheck`, and `cd web; npm run build` succeeded.
- `npm test` is now a focused MySQL integration suite. All six scenarios passed: two tabs reloading together (with shared lock simulation), uncoordinated concurrent refresh, replay inside 10 seconds, replay after 30 seconds, logout cookie revocation plus cross-tab broadcast, and API refresh-and-retry after an invalid access token. The test creates and deletes one uniquely named user using the configured `DATABASE_URL`; use a disposable DB if the configured DB has data to preserve.
- Store, membership, invite, product, public storefront, coupon, checkout/order, and audit routes/services/controllers/schemas are implemented. Membership and role middleware resolve tenant authorization from MySQL. `npm run typecheck` passes; endpoint-by-endpoint manual API walkthroughs remain.
- The React/Vite frontend now includes account lifecycle screens, store selector, staff dashboard, public storefront, products, coupons, orders, staff, invitations, and audit views. Registration goes directly to email verification; direct `/s/:slug` storefront links are supported; an invitee can accept an invite from the store selector before joining a store.
- The frontend holds access tokens in React memory and relies on the HttpOnly refresh cookie. Do not restore the stale `web/README.md` sessionStorage description; it has been corrected.
- `npm --prefix web run build` passed after the latest frontend corrections. This checks frontend types/build, not route behavior in a browser.
- Latest proxy diagnosis: Vite logged `ECONNREFUSED 127.0.0.1:3000` because only the frontend was reachable. Starting `npm run dev:server` printed `Server listening on port 3000`, and `GET http://127.0.0.1:3000/health` returned `{ "status": "ok" }`. The server process may need restarting in the learner's own terminal. From the repository root, `npm run dev` starts both API and Vite via `concurrently`.
- No email transport is configured. Registration creates a verification token; local `NODE_ENV=development` responses expose `devToken`. The UI can complete this learning flow locally, but it does not send real email.
- Known backend follow-ups: reconcile PRD/API order states (`DELIVERED` vs `PROCESSING`/`COMPLETED`) and audit-reader roles (PRD includes MANAGER/SUPPORT; route only OWNER/ADMIN); make mock payment and order-note audit writes transactional; exercise tenant isolation, role boundaries, invites, checkout races, and cancellation/refund stock restoration. Product/order lists are currently unpaginated.

## Current cleanup status

The duplicate `/auth/me` registrations were removed from `src/app.ts`; the route lives only in `src/modules/auth/auth.routes.ts`, mounted once by the app. Auth imports were consolidated during implementation.

## Immediate next milestones

1. Resolve the two target/current mismatches with the learner before changing code: order progression (`DELIVERED` vs `PROCESSING`/`COMPLETED`) and audit log reader roles (PRD vs API route).
2. Fix mock payment + audit and order note + audit consistency using a transaction if the audit atomicity requirement stands.
3. Coach a backend walkthrough with two stores and multiple roles. Verify membership boundaries, invitation email/expiry/single use, checkout stock/coupon races, payment, cancellation/refund restoration, and audit output. Add regression tests as the learner requests/understands each case.
4. Walk through the frontend against both running services: register → verify using local `devToken` → sign in → refresh-cookie restore → `/auth/me` → logout; then password reset/change, invitation acceptance, dashboard role views, storefront, and mock checkout.
5. Do not start another large feature before these security and contract checks. Pagination is an optional backend performance lesson after correctness.

## Engineering conventions

- Explain controller/service/middleware/schema boundaries: routes connect middleware and controllers; controllers translate HTTP and call services; services hold business rules and database operations; Prisma schema/migrations define persistent state.
- Tenant-scoped reads and writes must check membership and constrain the database query with the relevant `storeId`. Never rely on opaque IDs as authorization.
- Read role/membership from MySQL per request; do not put store roles in access JWTs.
- Keep access tokens short-lived; refresh/reset/invite tokens are random opaque secrets, stored only as hashes, single-use/rotated/expiring as appropriate.
- Keep refresh tokens in HttpOnly cookies; never return or put them in browser storage. Coordinate rotations across tabs, return token-free `REFRESH_RETRY` only during the short grace interval, and broadcast logout to other tabs.
- Use generic authentication/reset responses where account enumeration would be a concern.
- Validate request bodies with strict Zod schemas; never accept protected server-owned fields via mass assignment.
- Preserve current MySQL/Prisma 7 adapter setup. Inspect installed Prisma APIs and schema before giving migration instructions.
- Never expose `.env` secrets in output. Do not change root DB credentials in docs.
- Do not claim tests passed unless actually run; distinguish typecheck, manual smoke check, and automated tests.

## How to resume

First inspect `git status`, `src/app.ts`, `src/modules/auth/auth.routes.ts`, auth files, `web/src/api.ts`, `web/src/auth-coordination.ts`, and `prisma/schema.prisma`. Confirm the route duplication status before instructing the learner. Then tell them the single next step, with a short explanation and copy/paste code if requested. Update this handoff status when substantial milestones change.
