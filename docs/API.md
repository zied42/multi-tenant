# API plan and current endpoints

Base URL: `http://localhost:3000`. JSON request/response bodies. Protected routes use `Authorization: Bearer <accessToken>`. This file separates endpoints implemented today from target endpoints so plans are not mistaken for finished code.

## Conventions

- IDs are strings (Prisma CUIDs).
- Money is an integer number of minor units.
- Request bodies are strict Zod objects; server-owned fields such as `id`, `storeId`, `role`, `total`, and order status are not accepted unless explicitly part of an operation.
- Standard error shape: `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`.
- Common status: 400 invalid input; 401 missing/invalid auth; 403 role denied; 404 missing/out-of-scope resource; 409 business conflict; 429 rate limit.

## Implemented endpoints

| Method | Path | Auth | Request | Result |
|---|---|---|---|---|
| GET | `/health` | No | — | `{ "status": "ok" }` |
| POST | `/auth/register` | No | `{email,password}` | 201 safe user profile; development only includes `devToken` for email verification |
| POST | `/auth/login` | No | `{email,password}` | 200 user + 15-minute access token and 7-day refresh token; verified email required |
| POST | `/auth/refresh` | Refresh token in JSON body | `{refreshToken}` | Rotate refresh token and issue a fresh token pair |
| POST | `/auth/logout` | Refresh token in JSON body | `{refreshToken}` | Revoke token family; 204 |
| PATCH | `/auth/password` | Bearer access token | `{currentPassword,newPassword}` | Change password and revoke refresh sessions |
| POST | `/auth/password-reset/request` | No | `{email}` | 202 generic response; development only includes `devToken` |
| POST | `/auth/password-reset/complete` | No | `{token,newPassword}` | Consume one-use reset token; revoke refresh sessions |
| POST | `/auth/email-verification/request` | No | `{email}` | 202 generic response; development only includes `devToken` |
| POST | `/auth/email-verification/complete` | No | `{token}` | Consume one-use verification token |
| GET | `/auth/me` | Bearer access token | — | 200 current safe user profile |

The register → login → `/auth/me` flow was manually exercised before email verification was added. The lifecycle migration is applied and typecheck passes; refresh/reset/verification flows still need a manual walkthrough. Each auth operation has an in-memory IP rate limit in addition to the global limiter. Raw debug tokens are returned only when `NODE_ENV=development`; do not expose this mode on a public server.

Reset tokens expire after 30 minutes, email verification tokens after 24 hours, and refresh tokens after 7 days. Reset and verification tokens are stored as SHA-256 hashes and are single-use. No real email delivery is connected.

## Target stores and members

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/stores` | Any authenticated user | Create store and OWNER membership atomically |
| GET | `/stores` | Any authenticated user | List caller's stores and per-store role |
| GET | `/stores/:storeId` | Any member | Read store |
| PATCH | `/stores/:storeId` | OWNER, ADMIN | Update settings |
| DELETE | `/stores/:storeId` | OWNER | Delete store and associated tenant data |
| POST | `/stores/:storeId/transfer-ownership` | OWNER | Transfer ownership to existing member |
| GET | `/stores/:storeId/members` | Member | List members |
| PATCH | `/stores/:storeId/members/:userId` | OWNER, ADMIN | Change role under hierarchy rules |
| DELETE | `/stores/:storeId/members/:userId` | OWNER, ADMIN | Remove member under hierarchy rules |
| POST | `/stores/:storeId/leave` | Member except last OWNER | Leave store |

## Target invites

| Method | Path | Roles | Purpose |
|---|---|---|---|
| POST | `/stores/:storeId/invites` | OWNER, ADMIN | Create expiring lower-role invite |
| GET | `/stores/:storeId/invites` | OWNER, ADMIN | List pending invites without raw tokens |
| DELETE | `/stores/:storeId/invites/:inviteId` | OWNER, ADMIN | Revoke invite |
| POST | `/invites/accept` | Authenticated user | Accept one-use invite matching account email |

## Target catalog and storefront

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/stores/:storeId/products` | List/create staff products |
| GET/PATCH/DELETE | `/stores/:storeId/products/:productId` | Read/update/archive tenant-scoped product |
| GET | `/s/:slug` | Public store information |
| GET | `/s/:slug/products` | Public active product list |
| GET | `/s/:slug/products/:productId` | Public active product detail |

## Target coupons, checkout, and orders

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/stores/:storeId/coupons` | List/create staff coupons |
| PATCH/DELETE | `/stores/:storeId/coupons/:couponId` | Change/remove coupon |
| POST | `/s/:slug/orders` | Guest checkout; server computes all totals |
| POST | `/s/:slug/orders/:orderId/pay` | Mock payment; no client amount/status input |
| GET | `/s/:slug/orders/:orderId` | Guest status via high-entropy public token |
| GET | `/stores/:storeId/orders` | Staff order listing |
| GET | `/stores/:storeId/orders/:orderId` | Staff detail, items, notes |
| PATCH | `/stores/:storeId/orders/:orderId/status` | Allowed state transitions only |
| POST | `/stores/:storeId/orders/:orderId/refund` | Mock refund and stock restoration |
| POST | `/stores/:storeId/orders/:orderId/notes` | Add staff note according to role |
| GET | `/stores/:storeId/audit-log` | Read scoped audit history |

Detailed payload schemas should be added here as endpoints are designed, not copied blindly from the original PostgreSQL proposal. Every tenant query must be scoped by verified `storeId`.
