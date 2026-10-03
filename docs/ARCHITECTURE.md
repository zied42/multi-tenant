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
  -> route (/auth, later /stores and /s/:slug)
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

Each feature module keeps its routes, controller, service, and schema together. The actual business modules are currently scaffolds.

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
- Refresh token: cryptographically random opaque token, SHA-256 hash stored in DB, expires after 7 days, and is rotated on every refresh. Reuse of a revoked token revokes active tokens in its family.
- Password reset: high-entropy one-use token, stored as a hash, expires after 30 minutes. Reset revokes refresh sessions.
- Email verification: high-entropy one-use token, stored as a hash, expires after 24 hours. Login requires a verified email.
- Logout revokes the refresh-token family; already-issued access tokens remain valid for up to 15 minutes.
- Development-only API responses expose `devToken` so the learner can exercise reset and verification without email. Do not expose these responses on a public server.
- Login uses the same public error for unknown email and wrong password.

## Core data model

Current schema contains `User`, `Store`, `Membership`, `RefreshToken`, `PasswordResetToken`, and `EmailVerificationToken`, plus the `Role` enum. `User` has nullable `emailVerifiedAt`; refresh records carry a `familyId` for reuse handling. Remaining planned models:

- `Invite(storeId, email, role, tokenHash, expiresAt, usedAt, invitedBy)`
- `Product(storeId, name, price, stock, status, ...)`
- `Coupon(storeId, code, type, value, expiresAt, maxUses, usedCount)`
- `Order(storeId, customerEmail, status, subtotal, discount, total, publicTokenHash, ...)`
- `OrderItem(orderId, productId, qty, unitPrice)`
- `OrderNote(orderId, authorId, body, createdAt)`
- `AuditLog(storeId, actorId, action, targetId, metadata, createdAt)`

Use integer minor units for money. Add appropriate unique constraints and indexes. Use transactions for store+OWNER creation, invite acceptance, checkout, and audited sensitive changes.

## Checkout and state invariants

- Resolve active products by both their IDs and the current store ID.
- Price, discount, and total are computed from database values only.
- Atomically decrement inventory only where `stock >= qty`; reject if not enough.
- Atomically reserve a coupon use under its limit.
- Create order and item price snapshots in the same transaction.
- Payment is mock-only and can transition only a valid pending order.
- Enforce allowed state transitions in a central service/policy; do not accept arbitrary status from a client.

## Errors and observability

Use a consistent JSON error response with code/message/requestId. Do not send stack traces, SQL, or internal details to clients. Request ID is generated once and included in logs/response. Pino redacts authorization headers, password fields, and token values. Never log raw reset/invite/refresh tokens.

## Route ownership

All auth routes are defined in `src/modules/auth/auth.routes.ts`. `src/app.ts` mounts that router once at `/auth`; keep route definitions out of `app.ts`.
