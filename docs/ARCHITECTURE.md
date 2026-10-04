# Architecture

## Current stack and decisions

| Concern | Current decision |
|---|---|
| Runtime | Node.js 24 on the learner's Windows machine |
| Language/module system | TypeScript strict mode, ESM (`"type": "module"`; `.js` import suffixes) |
| HTTP | Express 5 |
| Database | Locally installed MySQL; database `storeforge_dev` |
| ORM | Prisma 7 with `prisma-client` generator and `@prisma/adapter-mariadb` |
| Validation | Zod |
| Passwords | Argon2id |
| JWT | `jose`, HS256, 15-minute access token |
| Logging/security | Pino, Helmet, CORS allowlist, `express-rate-limit`, request ID |

Do not switch database to PostgreSQL because an input design file says so. The human chose MySQL. Prisma 7 reads datasource URL through root `prisma7.config.ts`; the schema's datasource only specifies `provider = "mysql"`.

## Request path and layers

```text
HTTP client
  -> Express global middleware (requestId, requestLogger, helmet, CORS,
     rate limit, JSON limit)
  -> route (/auth, /stores, /invites, /s/:slug)
  -> route middleware (authenticate, membership, permission, validation)
  -> controller (HTTP in/out only)
  -> service (business rules and Prisma operations)
  -> MySQL
  -> not-found handler / centralized error handler
```

Routes declare the order of route-specific middleware. The application should mount each router exactly once. Keep controllers free of direct Prisma calls; services own domain and persistence work.

## Folder layout

```text
src/
  app.ts                 # construct/export Express app; no listen()
  server.ts              # load app and listen
  config/env.ts          # Zod validation for process env
  lib/                   # Prisma client, JWT, password/token helpers, errors, logger
  middleware/            # authentication, tenant membership, role, validation, errors
  modules/<feature>/     # routes, controller, service, schemas
  policies/permissions.ts
prisma/
  schema.prisma
  migrations/
docs/
```

Each feature module keeps its routes, controller, service, and schema together. Store, membership, invite, product, storefront, coupon, order, and audit API implementations are now in place. The frontend lives under `web/src`, including account flows, store selector, dashboard, and public storefront. The Vite development proxy forwards `/api/*` to Express on `127.0.0.1:3000`; run `npm run dev` at the repository root to start both services.

## Tenant isolation

Use one MySQL database and shared tables with `storeId` on each store-owned model. Before staff actions:

1. Verify the short-lived access token and resolve its `sub` to a user ID.
2. Read `storeId` from the route, not the request body.
3. Resolve the user's `Membership(userId, storeId)` from MySQL on each request.
4. Return 404 for no membership on a store route to avoid leaking whether another tenant exists.
5. Check the membership role against a centralized permission map.
6. Scope every tenant record lookup/update to both its ID and verified `storeId` (`findFirst({where:{id,storeId}})`), including indirect/order-item operations.

Never treat an opaque ID, a client-supplied `storeId`, a JWT role claim, or UI visibility as authorization. No Postgres RLS is planned for the MySQL version; query scoping and membership checks are the teaching target.

## Authentication design

- Passwords: Argon2id hashes; never store or return plaintext passwords.
- Access token: JWT signed HS256, 15-minute lifetime, `sub`, `iat`, `exp`, `iss`, `aud`; no store role claim. Current helper already signs/verifies these.
- Refresh token: cryptographically random opaque token, SHA-256 hash stored in DB, expires after 7 days, and is rotated on every refresh. `rotatedAt` records rotation time. A replay within the 10-second grace interval returns `401 REFRESH_RETRY` without issuing tokens or revoking the family; a later replay revokes active tokens in the family. Refresh reads lock the token row (`SELECT ... FOR UPDATE`) so concurrent MySQL transactions see the latest rotation state.
- Password reset: high-entropy one-use token, stored as a hash, expires after 30 minutes. Reset revokes refresh sessions.
- Email verification: high-entropy one-use token, stored as a hash, expires after 24 hours. Login requires a verified email.
- The refresh token is delivered only in an HttpOnly cookie (`SameSite=Lax`, `Path=/api/auth`; `Secure` in production). The browser-facing `/api/auth` path is preserved by the Vite proxy while Express receives `/auth`.
- The React app keeps access tokens in memory. Startup silently refreshes through the cookie, then loads `/auth/me`. Authenticated API calls that fail with an expired/invalid access-token 401 refresh once and retry once.
- Refresh operations use same-tab single-flight and the Web Locks API across same-origin tabs. The backend row lock and short grace response also protect clients that issue simultaneous refreshes without the browser lock.
- Logout and password changes broadcast a logout message to other same-origin tabs through `BroadcastChannel`, clearing their in-memory sessions.
- Logout revokes the refresh-token family; already-issued access tokens remain valid for up to 15 minutes.
- Development-only API responses expose `devToken` so the learner can exercise reset and verification without email. Do not expose these responses on a public server.
- Login uses the same public error for unknown email and wrong password.

## Core data model

Current schema contains `User`, `Store`, `Membership`, `RefreshToken`, `PasswordResetToken`, `EmailVerificationToken`, `Invite`, `Product`, `Coupon`, `Order`, `OrderItem`, `OrderNote`, and `AuditLog`, plus `Role`, `ProductStatus`, `CouponType`, and `OrderStatus` enums. `User` has nullable `emailVerifiedAt`; refresh records carry a `familyId` and nullable `rotatedAt` for reuse handling.

- `Invite(storeId, email, role, tokenHash, expiresAt, usedAt, invitedBy)`
- `Product(storeId, name, price, stock, status, ...)`
- `Coupon(storeId, code, type, value, expiresAt, maxUses, usedCount)`
- `Order(storeId, customerEmail, status, subtotal, discount, total, publicTokenHash, ...)`
- `OrderItem(orderId, productId, qty, unitPrice)`
- `OrderNote(orderId, authorId, body, createdAt)`
- `AuditLog(storeId, actorId, action, targetId, metadata, createdAt)`

Use integer minor units for money. Models have tenant indexes and relevant unique constraints. Transactions are used for store+OWNER creation, invite acceptance, checkout, order state changes, and inventory restoration. One known gap: mock payment updates the order and then writes its audit event as a separate operation. Make both writes one transaction before treating audit completeness as an invariant. Order notes and their audit event also currently use separate writes.

## Checkout and state invariants

- Resolve active products by both their IDs and the current store ID.
- Price, discount, and total are computed from database values only.
- Atomically decrement inventory only where `stock >= qty`; reject if not enough.
- Atomically reserve a coupon use under its limit.
- Create order and item price snapshots in the same transaction.
- Payment is mock-only and can transition only a valid pending order.
- Enforce allowed state transitions in a central service/policy; do not accept arbitrary status from a client.
- Current enum/workflow uses `PROCESSING` and `COMPLETED`; the PRD currently says `DELIVERED`. Decide the intended state model and align schema, API, UI, and docs.

## Current verification gaps

- Product and order list endpoints currently return the matching collection without pagination. This is acceptable for the local learning dataset; pagination is a later performance lesson.
- The PRD grants audit-log access to MANAGER and SUPPORT, but the current audit router permits only OWNER and ADMIN. Resolve the permission policy before adding role tests.
- Permission matrices, cross-tenant object access, invitation expiry/email binding, checkout races, and refund/cancellation inventory behavior still need walkthroughs or regression tests.
- Email verification and password-reset tokens are generated for local development. No email transport is configured.

## Errors and observability

Use a consistent JSON error response with code/message/requestId. Do not send stack traces, SQL, or internal details to clients. Request ID is generated once and included in logs/response. Pino redacts authorization headers, password fields, and token values. Never log raw reset/invite/refresh tokens.

## Route ownership

All feature routes are defined in their module routers. `src/app.ts` mounts auth, stores, invites, and storefront routers once; keep individual route definitions out of `app.ts`.
