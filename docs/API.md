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
| POST | `/auth/login` | No | `{email,password}` | 200 safe user + 15-minute access token; sets 7-day refresh token as an HttpOnly cookie; verified email required |
| POST | `/auth/refresh` | `storeforge_refresh` HttpOnly cookie | Empty body | Rotate cookie and return a new access token; a recent duplicate rotation returns 401 `REFRESH_RETRY` without issuing tokens |
| POST | `/auth/logout` | `storeforge_refresh` HttpOnly cookie | Empty body | Revoke token family, clear cookie; 204 |
| PATCH | `/auth/password` | Bearer access token | `{currentPassword,newPassword}` | Change password and revoke refresh sessions |
| POST | `/auth/password-reset/request` | No | `{email}` | 202 generic response; development only includes `devToken` |
| POST | `/auth/password-reset/complete` | No | `{token,newPassword}` | Consume one-use reset token; revoke refresh sessions |
| POST | `/auth/email-verification/request` | No | `{email}` | 202 generic response; development only includes `devToken` |
| POST | `/auth/email-verification/complete` | No | `{token}` | Consume one-use verification token |
| GET | `/auth/me` | Bearer access token | — | 200 current safe user profile |
| POST | `/stores` | Bearer access token | `{name}` | 201 store and OWNER membership created atomically |
| GET | `/stores` | Bearer access token | — | 200 caller's stores and membership roles |
| GET | `/stores/:storeId` | Store member | — | 200 store details |
| PATCH | `/stores/:storeId` | OWNER, ADMIN | `{name}` | 200 updated store |
| DELETE | `/stores/:storeId` | OWNER | — | 204 delete store |
| POST | `/stores/:storeId/transfer-ownership` | OWNER | `{userId}` | 204 transfer owner to an existing member |
| GET | `/stores/:storeId/members` | Store member | — | 200 safe member details |
| PATCH | `/stores/:storeId/members/:userId` | OWNER, ADMIN | `{role}` | 200 change member role under role hierarchy |
| DELETE | `/stores/:storeId/members/:userId` | OWNER, ADMIN | — | 204 remove member under role hierarchy |
| POST | `/stores/:storeId/leave` | Store member | — | 204 leave unless caller is last owner |
| POST | `/stores/:storeId/invites` | OWNER, ADMIN | `{email,role}` | 201 invite; development only includes `devToken` |
| GET | `/stores/:storeId/invites` | OWNER, ADMIN | — | 200 pending invites, no raw token |
| DELETE | `/stores/:storeId/invites/:inviteId` | OWNER, ADMIN | — | 204 revoke pending invite |
| POST | `/invites/accept` | Bearer access token | `{token}` | 200 create membership if account email matches invite |
| GET | `/stores/:storeId/products` | Store member | — | 200 tenant-scoped non-archived catalogue |
| POST | `/stores/:storeId/products` | OWNER, ADMIN, MANAGER | `{name,description?,price,stock?,status?}` | 201 create product; price is integer minor units |
| GET | `/stores/:storeId/products/:productId` | Store member | — | 200 tenant-scoped product |
| PATCH | `/stores/:storeId/products/:productId` | OWNER, ADMIN, MANAGER | product fields | 200 update product |
| DELETE | `/stores/:storeId/products/:productId` | OWNER, ADMIN, MANAGER | — | 204 archive product |
| GET | `/s/:slug` | No | — | 200 public store details |
| GET | `/s/:slug/products` | No | — | 200 active products only |
| GET | `/s/:slug/products/:productId` | No | — | 200 active product in that store only |

The browser uses `/api` as its base path through the Vite proxy; Express receives `/auth/...`. The refresh cookie is HttpOnly, `SameSite=Lax`, scoped to `/api/auth`, and `Secure` when `NODE_ENV=production`. The browser never receives the refresh token in JSON. The access token is held in React memory and sent as a Bearer token. On app startup, the frontend silently refreshes the session and then loads `/auth/me`.

Frontend refresh requests use same-tab single-flight plus the Web Locks API to coordinate tabs. The backend also locks the presented token row in MySQL. A recently rotated token replay within 10 seconds returns 401 `REFRESH_RETRY` and leaves the active family token alone; a replay after that grace window returns 401 `REFRESH_TOKEN_REUSE` and revokes active tokens in the family. Logout broadcasts to other same-origin tabs and clears their in-memory sessions.

Each auth operation has an in-memory IP rate limit in addition to the global limiter. Raw debug tokens are returned only when `NODE_ENV=development`; do not expose this mode on a public server. No real email delivery is connected.

Reset tokens expire after 30 minutes, email verification tokens after 24 hours, and refresh tokens after 7 days. Reset and verification tokens are stored as SHA-256 hashes and are single-use. The `npm test` suite covers refresh coordination, replay grace/revocation, logout broadcast, and API refresh-and-retry against the configured MySQL database. It creates and deletes a uniquely named test user; point `DATABASE_URL` at a disposable database before running it if the database contains data you need to preserve.

| GET | `/stores/:storeId/coupons` | OWNER, ADMIN, MANAGER | — | 200 tenant coupons |
| POST | `/stores/:storeId/coupons` | OWNER, ADMIN, MANAGER | `{code,type,value,maxUses?,expiresAt?}` | 201 coupon; type is `PERCENT` or `FIXED` minor units |
| PATCH | `/stores/:storeId/coupons/:couponId` | OWNER, ADMIN, MANAGER | coupon fields | 200 updated coupon |
| DELETE | `/stores/:storeId/coupons/:couponId` | OWNER, ADMIN, MANAGER | — | 204 deactivate coupon |
| POST | `/s/:slug/orders` | No | `{customerName,customerEmail,items,couponCode?}` | 201 order plus one-time `publicToken`; server prices and reserves stock |
| POST | `/s/:slug/orders/:orderId/pay` | `X-Order-Token` | Empty body | 200 mock payment; only pending orders can be paid |
| GET | `/s/:slug/orders/:orderId` | `X-Order-Token` | — | 200 guest order status and totals |
| GET | `/stores/:storeId/orders` | Store member | — | 200 tenant-scoped orders |
| GET | `/stores/:storeId/orders/:orderId` | Store member | — | 200 order details, line snapshots, and notes |
| PATCH | `/stores/:storeId/orders/:orderId/status` | OWNER, ADMIN, MANAGER | `{status}` (`PROCESSING`, `SHIPPED`, `COMPLETED`, or `CANCELLED`) | 200 valid state transition |
| POST | `/stores/:storeId/orders/:orderId/refund` | OWNER, ADMIN | Empty body | 200 mock refund and inventory restoration |
| POST | `/stores/:storeId/orders/:orderId/notes` | OWNER, ADMIN, MANAGER, SUPPORT | `{body}` | 201 staff note |
| GET | `/stores/:storeId/audit-log?limit=50` | OWNER, ADMIN | — | 200 latest store-scoped audit events; limit 1–100 |

Every tenant query is intended to be scoped by verified `storeId`; tenant-boundary behavior still needs explicit cross-store checks. Checkout uses a serializable database transaction and returns the high-entropy guest token only once; clients must keep it and send it in `X-Order-Token` for guest status and mock payment.

## Current limitations and known mismatches

- Order state names in the implementation are `PENDING`, `PAID`, `PROCESSING`, `SHIPPED`, `COMPLETED`, `CANCELLED`, and `REFUNDED`. The PRD currently describes a flow ending in `DELIVERED`; decide whether to change the PRD or implement/rename that state before treating the state machine as final.
- The audit route currently permits only OWNER and ADMIN. The PRD role table also grants audit visibility to MANAGER and SUPPORT. Decide on one policy and align the PRD, backend, and UI.
- Mock payment updates the order and writes its audit event in separate DB operations. A failure after the update can leave a paid order without its audit entry. Order-note creation and its audit entry are also separate writes.
- Product and order list endpoints currently have no pagination. Fine for a small local learning dataset; add pagination as a later API/performance exercise.
- Email verification/reset tokens are returned only as development `devToken` values. No email provider is configured, so the frontend cannot deliver or receive a real email in this version.
- Implemented routes have not all received runtime or regression coverage. Prioritize role matrix, cross-tenant denial, invite expiry/email binding, checkout concurrency, and inventory restoration checks.

## Local development

Run both services from the repository root with `npm run dev`. This starts the API
on port 3000 and Vite on port 5173. If Vite reports `ECONNREFUSED` while proxying
`/auth/*`, the API is not listening; run `npm run dev:server` or restart both with
`npm run dev`. Confirm API startup at `http://127.0.0.1:3000/health`.
