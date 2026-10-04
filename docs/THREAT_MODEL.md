# Threat model

This is a learning threat model for a local multi-tenant commerce app. Use it to drive implementation and later security exercises, not as a claim that controls already exist.

## Scope and assets

In scope: Express API, account lifecycle, membership/role checks, tenant-scoped MySQL data, checkout rules, local secrets, and later frontend/API boundary.

| Asset | Why protect it |
|---|---|
| Store products, orders, customer email, coupon data | One tenant must not see another tenant's records |
| Membership and role assignments | Control access to all store operations |
| Passwords, access/refresh/reset/invite tokens | Prevent account or store takeover |
| Prices, order totals, stock, coupon usage | Preserve commerce integrity |
| Audit records | Explain sensitive actions |
| JWT secret and DB credentials | Compromise enables broad access |

## Trust boundaries

1. Browser/Postman input to Express (untrusted fields and payload sizes).
2. Anonymous request to authenticated account.
3. Authenticated account to each store tenant (membership and role boundary).
4. Public checkout to private inventory/pricing rules.
5. Application to local MySQL.

## Main threats and learning controls

| ID | Threat | Planned control / lesson |
|---|---|---|
| TM-01 | Cross-tenant object read/write (BOLA/IDOR) | Validate membership and constrain every query with verified `storeId`; test with two stores. |
| TM-02 | Role escalation or ADMIN affecting OWNER | Central permission map plus service-level hierarchy and last-owner rules. |
| TM-03 | Mass assignment of `storeId`, `role`, price, total, or status | Strict Zod schemas and explicit Prisma `data` fields. |
| TM-04 | Stolen/replayed refresh token | Hash at rest, expire, rotate, row-lock during refresh, return token-free `REFRESH_RETRY` during the 10-second concurrency grace, revoke the family on later reuse, and never log raw values. |
| TM-05 | Reset/invite token theft or replay | High entropy, hash in DB, one-use, expiry, bind to intended account/email. |
| TM-06 | Password guessing/user enumeration | Argon2id, strict auth rate limits, uniform credential and reset responses. |
| TM-07 | JWT substitution or long-lived access | Pin HS256, validate issuer/audience/expiry, use strong env secret, short TTL. |
| TM-08 | Stale role after member demotion | Do not encode roles in JWT; load membership on each tenant request. |
| TM-09 | Client manipulates price/payment state | Price from DB, server computes all values, mock payment transition checked server-side. |
| TM-10 | Overselling or coupon double-use race | Transactions and atomic conditional updates; concurrency exercise later. |
| TM-11 | Guest order enumeration | Require high-entropy order access token; store/compare safely. |
| TM-12 | Error/log leaks | Generic client errors, request IDs, logger redaction, no stack/SQL/token response. |
| TM-13 | Malicious/oversized request | JSON body limit, Zod bounds, global and endpoint-specific rate limits. |
| TM-14 | Secret committed | Ignore `.env`, keep placeholders in `.env.example`, later scan Git history/CI. |

## Required tenant review checklist

- [ ] Does this endpoint check the caller's membership for the path's store?
- [ ] Does every ID-based tenant query include `storeId`?
- [ ] Is store ownership derived from verified route/membership rather than body/JWT role?
- [ ] Can a lower role modify a higher/equal role or themselves?
- [ ] Are secrets/tokens excluded from response/logs and stored only as hashes where appropriate?
- [ ] Does the client control any price, discount, stock, payment, or order status?
- [ ] Are multi-row state changes transactional and race-safe?
- [ ] Are errors uniform enough to avoid leaking account/store existence?

## Accepted learning limitations

The first pass uses local MySQL, mock payment, local reset/verification links, and no production deployment. No real email delivery, MFA, fraud controls, or payment provider is planned initially. These are deliberate scope choices, not claims of production readiness. Postgres RLS from the supplied draft does not apply to the selected MySQL project and is not planned.

## Security review method (later phase)

After features exist, choose one threat at a time: reproduce the unsafe behavior in a local test, explain the root cause, fix it, and preserve a regression test. Do not intentionally expose the local app publicly or use real user data/secrets.

## Current gaps to carry into review (2026-10-04)

- Exercise role checks and cross-tenant access with at least two stores. Compile/typecheck success does not prove tenant isolation.
- Checkout creation is transactional, but mock payment currently commits the status update before writing the audit event. Order-note creation and its audit event are also separate writes. A DB failure can therefore leave incomplete audit coverage.
- The PRD and implementation disagree about audit-log readers (PRD includes MANAGER/SUPPORT; API allows OWNER/ADMIN) and order progression (`DELIVERED` in PRD versus `PROCESSING`/`COMPLETED` in code). Resolve the intended policies before claiming the matrix/state machine is verified.
- Product and order list reads are unpaginated. This is a local learning-app limitation, not an immediate production concern.
- Email verification and password reset are local token flows with no mail transport. Development responses expose `devToken`; never run this mode as a public service.
- The frontend verification step now follows registration. The Vite proxy requires the API on port 3000; `ECONNREFUSED` for `/auth/*` means the backend process is unavailable, not that the browser token is invalid.

## Current auth session controls

- The refresh token is stored in an HttpOnly cookie; JavaScript receives only the short-lived access token, held in React memory.
- Web Locks coordinate refreshes across same-origin tabs; a module-level single-flight promise deduplicates requests inside one tab.
- The MySQL refresh row is locked during rotation. `rotatedAt` distinguishes a near-simultaneous retry (401 `REFRESH_RETRY`, family remains usable) from a later replay (401 `REFRESH_TOKEN_REUSE`, active family tokens are revoked).
- Logout and password changes publish a `BroadcastChannel` logout event so other tabs clear their in-memory session.
- Focused integration tests cover simultaneous refresh, the grace interval, a replay after 30 seconds, logout broadcast/revocation, and one refresh-and-retry API request. These tests use the configured `DATABASE_URL` and clean up their generated user; use a disposable database for testing.
- `SameSite=Lax` is a baseline for this local same-origin setup. A public deployment still needs a deliberate CSRF review and deployment-specific cookie/CORS configuration.
