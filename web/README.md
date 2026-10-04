# Storeforge web

React, TypeScript, and Vite frontend for the Storeforge API. It includes the public
storefront, store selector, staff dashboard, and account lifecycle screens.

## Run locally

From the repository root, start both API and frontend together:

    npm run dev

This uses `concurrently` to run `npm run dev:server` and `npm run dev:web`. The Vite
dev server runs at http://localhost:5173 and proxies `/api` requests to the Express
API at http://127.0.0.1:3000. If Vite logs `ECONNREFUSED` for `/auth/*`, the API
process is not listening on port 3000; start it with `npm run dev:server` or restart
both with `npm run dev` from the repository root. The API health check is
http://127.0.0.1:3000/health.

The interface supports registration followed by email verification, login, session
refresh/logout, password change/reset, store selection, invitation acceptance,
products, coupons, staff, orders, audit viewing, and public storefront checkout.
Storefronts are directly addressable at `/s/:slug`. With `NODE_ENV=development`,
the API returns local-only `devToken` values so verification and reset can be tried
without an email service. No real email is sent.

## Session handling

The access token lives in React memory. The refresh token is held by the browser in
an HttpOnly, SameSite cookie set by the API; JavaScript never reads it. Startup
session restoration calls the refresh endpoint. Same-tab single-flight, Web Locks,
and a BroadcastChannel coordinate refresh and logout across tabs. The development
token responses must never be exposed publicly.

## Current limitations

- Email delivery is not configured; local development tokens are used instead.
- Checkout uses mock payment and guest order access.
- The frontend build succeeds, but backend permission, tenant-isolation, and checkout
  scenarios still need guided runtime or automated checks.

## Build

    npm --prefix web run build
