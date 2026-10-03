# AI handoff and collaboration guide

Read this document before making suggestions or changes. It records the human's goal and the project's current state so a future agent can continue without restarting or taking over.

## Human's goal and preferred workflow

- The human is learning to build this app from scratch. **Coach them; do not silently implement the product for them.**
- The normal loop is: explain one small next step and why it matters, provide copy/paste-ready code when asked, let the human add it, then inspect/typecheck when they say `done`, `next`, or ask for a check.
- Do not assume a suggested edit was applied. Inspect the actual file first; the human has previously added imports but missed the route that used them.
- When the human explicitly says “do it” or “implement it”, make the requested changes and verify them. Otherwise follow the coaching loop.
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

## Current status snapshot (2026-10-03)

Verified in `E:\multi tenant`:

- Git and npm project initialized; `.env` ignored by Git.
- Node v24.19.0, npm 11.17.0, Git 2.55.0 on the learner's Windows setup.
- Local MySQL `storeforge_dev` is configured through Prisma 7's `prisma7.config.ts` and `@prisma/adapter-mariadb`.
- Prisma schema has `User`, `Store`, `Membership`, `RefreshToken`, `PasswordResetToken`, and `EmailVerificationToken`, plus `Role`. Initial and `auth_lifecycle` migrations have been applied; Prisma Client was regenerated.
- CommonJS was changed to ESM (`package.json` has `"type": "module"`). TS imports use `.js` suffixes.
- Express has request IDs/logging, Helmet, CORS allowlist, a global rate limiter, JSON body limit, `/health`, 404 and error handling.
- `auth` implements registration, login, `/auth/me`, refresh rotation and reuse-family revocation, logout, password change, password reset, and email verification. Passwords use Argon2id; opaque lifecycle tokens are stored as SHA-256 hashes; request validation uses Zod.
- Auth routes have per-operation in-memory IP limits. In `development`, register/reset/verification responses include a `devToken` so flows work without an email provider. Never expose a dev-mode server publicly.
- `npx prisma migrate dev --name auth_lifecycle`, Prisma generation, and `npm run typecheck` succeeded. The old register/login/me smoke check passed before verification became mandatory; the newly implemented lifecycle still needs a manual walkthrough.
- Other business module files and tenancy/RBAC middleware/policy files exist but are mostly empty scaffolds, not completed endpoints.
- `npm test` is still the `npm init` placeholder; no meaningful automated test suite exists. Do not claim otherwise.
- A dev server was started on port 3000 for the smoke flow. If still running, the learner can stop it with Ctrl+C in its terminal.

## Current cleanup status

The duplicate `/auth/me` registrations were removed from `src/app.ts`; the route lives only in `src/modules/auth/auth.routes.ts`, mounted once by the app. Auth imports were consolidated during implementation.

## Immediate next milestones

1. Manually walk through register → dev email verification → login → `/auth/me` → refresh; confirm old refresh token fails and reuse revokes the family.
2. Walk through logout, password change, password reset, and confirm reset revokes refresh sessions. Fix any issues found and explain each code path.
3. Add focused automated tests when the learner is ready; `npm test` is still the starter placeholder.
4. Continue with store creation and OWNER membership, then tenant authorization, invitations, products, storefront, checkout/orders, coupons, audit, and frontend.

## Engineering conventions

- Explain controller/service/middleware/schema boundaries: routes connect middleware and controllers; controllers translate HTTP and call services; services hold business rules and database operations; Prisma schema/migrations define persistent state.
- Tenant-scoped reads and writes must check membership and constrain the database query with the relevant `storeId`. Never rely on opaque IDs as authorization.
- Read role/membership from MySQL per request; do not put store roles in access JWTs.
- Keep access tokens short-lived; refresh/reset/invite tokens are random opaque secrets, stored only as hashes, single-use/rotated/expiring as appropriate.
- Use generic authentication/reset responses where account enumeration would be a concern.
- Validate request bodies with strict Zod schemas; never accept protected server-owned fields via mass assignment.
- Preserve current MySQL/Prisma 7 adapter setup. Inspect installed Prisma APIs and schema before giving migration instructions.
- Never expose `.env` secrets in output. Do not change root DB credentials in docs.
- Do not claim tests passed unless actually run; distinguish typecheck, manual smoke check, and automated tests.

## How to resume

First inspect `git status`, `src/app.ts`, `src/modules/auth/auth.routes.ts`, auth files, and `prisma/schema.prisma`. Confirm the route duplication status before instructing the learner. Then tell them the single next step, with a short explanation and copy/paste code if requested. Update this handoff status when substantial milestones change.
