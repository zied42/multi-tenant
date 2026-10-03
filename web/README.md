# Storeforge web

React, TypeScript, and Vite auth UI for the Storeforge API.

## Run locally

Start the Express API from the repository root with npm run dev. In a second PowerShell window, run the frontend:

    npm --prefix web run dev

The Vite dev server runs at http://localhost:5173 and proxies /api requests to the Express API at http://localhost:3000.

The interface supports registration, local email verification, login, session refresh/logout, password change, and password reset. With NODE_ENV=development, the API returns local-only devToken values so the flows can be completed without an email service.

## Session note

This learning UI stores access and refresh tokens in sessionStorage so a page refresh can restore the session. This is a deliberate local learning shortcut, not a production storage recommendation. A production browser app should move refresh credentials to Secure, HttpOnly, SameSite cookies and review CSRF protections. Never expose the backend's development token responses publicly.

## Build

    npm --prefix web run build
