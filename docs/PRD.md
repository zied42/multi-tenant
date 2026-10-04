# Product requirements: Storeforge learning app

## Purpose

Build a multi-tenant commerce application from scratch as a structured learning project. The system gives each store separate catalog, staff, coupons, and orders. The project is for practicing backend and application security; it is not intended for real-life use or production deployment.

## Users

| Actor | What they can do |
|---|---|
| Visitor | Browse a store's active products. |
| Customer | Place a mock-paid order; initially can check out as a guest. |
| Account holder | Register, authenticate, manage account lifecycle, and join multiple stores. |
| Store staff | Work in stores according to a role assigned separately in each store. |

## Roles per store

Roles are stored on `Membership(userId, storeId, role)`, not globally on the user.

| Capability | OWNER | ADMIN | MANAGER | SUPPORT | VIEWER |
|---|:---:|:---:|:---:|:---:|:---:|
| Delete store / transfer ownership | Yes | | | | |
| Update store settings | Yes | Yes | | | |
| Manage members/invites | Yes | Limited* | | | |
| Manage products and inventory | Yes | Yes | Yes | | |
| Manage coupons | Yes | Yes | Yes | | |
| View orders | Yes | Yes | Yes | Yes | Yes |
| Change order status / refund | Yes | Yes | Yes | | |
| Add order notes | Yes | Yes | Yes | Yes | |
| View audit log | Yes | Yes | Yes | Yes | |

`*` ADMIN cannot change/remove an OWNER, grant OWNER/ADMIN, or act outside their authority. Hierarchy rules are enforced in services, not just role labels.

## Account lifecycle

- Register with normalized unique email and password hashed with Argon2id.
- Login with a short-lived access token and opaque refresh token.
- Load account identity from a verified token; never return the password hash.
- Refresh rotates the one-time refresh token; logout revokes the current refresh session.
- Change password while authenticated; revoke existing refresh sessions after a successful change.
- Request and complete a password reset using a single-use expiring token stored as a hash.
- Learn email verification using local-only verification links/tokens; no real email service in the first pass.
- Use generic reset/login outcomes where revealing account existence would enable enumeration.

## Main user stories

### Store management

- A registered user creates a store with a unique normalized slug and becomes its OWNER in one transaction.
- A user can own or work in multiple stores with a different role in each.
- An OWNER can transfer ownership; the previous OWNER becomes ADMIN. The last OWNER cannot leave or be removed.

### Members and invites

- OWNER/ADMIN can invite an email with an allowed role.
- Invite expires, can only be used once, is bound to its email, and is stored as a hash.
- OWNER/ADMIN can change roles or remove members within hierarchy limits.
- Members can leave except OWNER until they transfer ownership.

### Products and storefront

- MANAGER and above can create/update/archive products with integer minor-unit price, inventory, and draft/active state.
- Visitor can view only active products through a store slug.
- A product from one store cannot be used or revealed through another store's API.

### Checkout and orders

- Guest submits email, product IDs, quantities, and optional coupon.
- API calculates all prices, discounts, and totals from database values.
- Order item records preserve the price snapshot at checkout.
- Stock and coupon uses update atomically to avoid overselling/double use.
- Mock payment changes a valid pending order to paid; client never sets amount or payment status.
- Staff status flow: `PENDING -> PAID -> SHIPPED -> DELIVERED`; pending can be cancelled and paid/shipped can be refunded according to policy.

### Audit

Sensitive changes such as role changes/removals, invite actions, ownership transfer, coupon changes, store deletion, and refunds have an append-only audit record written in the same transaction.

## Product surfaces

1. Node/Express API (implemented first).
2. Staff dashboard: account, store, members, products, coupons, orders, invitations, and audit views (frontend is implemented; verify API/UI flows).
3. Public storefront: product browse and mock checkout (frontend is implemented; mock payment only).

The API is developed in small slices before building a broad UI.

## Learning non-functional goals

- Strict Zod validation for external input.
- Clear route/controller/service/database separation.
- Environment validation and secret hygiene.
- Shared-MySQL tenant isolation through membership checks and store-scoped queries.
- Centralized role/permission policy and uniform error format.
- Request IDs and structured logs with sensitive-field redaction.
- Later tests demonstrating cross-tenant and role boundaries.

## Deliberately out of scope initially

Real users, real production deployment, real payment processor, real email provider, complex taxes/shipping, webhooks, API keys, AI features, multi-region infrastructure, and Postgres RLS. These can be learning comparisons later if requested.

## Product success for this learner

The learner can explain and change the code, run the app locally, complete representative user flows, and demonstrate how tenant isolation and access control are enforced. Finishing features is less important than understanding the implementation and its failure cases.

## Current implementation differences to resolve

This PRD remains the intended product behavior; it is not a claim that each rule
already matches the code. As of 2026-10-04:

- The order state enum and API use `PROCESSING` and `COMPLETED`, while the target
  story above describes a path ending in `DELIVERED`. Choose the desired names and
  update the schema, migration, API, frontend, and docs consistently.
- The role matrix grants audit-log visibility to OWNER, ADMIN, MANAGER, and SUPPORT.
  The current audit route permits only OWNER and ADMIN. Confirm the intended policy
  before writing role-boundary tests.
- The target says sensitive action and audit writes should share a transaction.
  Current mock payment and order-note flows perform their audit writes separately;
  those are known consistency gaps to fix if the transaction rule remains.
- The current frontend implements the storefront and staff dashboard. Email and
  payment remain local/mock by design; no real email or payment provider is wired.
