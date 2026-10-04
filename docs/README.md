# Storeforge project docs

Storeforge is a hands-on learning project: a multi-tenant commerce app built from scratch to practice Node.js, TypeScript, Express, MySQL, Prisma, and application security. It is not intended for real customers or production deployment.

## Start here

1. [AI handoff and collaboration guide](AI_HANDOFF.md) — read this before continuing the coaching session.
2. [Learning plan](LEARNING_PLAN.md) — phases and concepts to learn in sequence.
3. [Product requirements](PRD.md) — what we intend to build and what we are deliberately leaving out.
4. [Architecture](ARCHITECTURE.md) — module boundaries, data design, tenancy, and security choices.
5. [API plan](API.md) — current endpoints and the target endpoint catalog.
6. [Threat model](THREAT_MODEL.md) — important failure cases and how to learn from them.
7. [DevSecOps learning plan](DEVSECOPS.md) — later verification and automation goals.

## Current reality

These documents distinguish the **target learning project** from the **current implementation**. The main backend modules and the React frontend are implemented. The frontend build and focused refresh-token tests are reported passing in the handoff; the rest of the API still needs permission, tenant-isolation, and checkout walkthroughs. There are known differences between the PRD and current API around order states and audit roles, and mock payment writes its audit event after the order update rather than in the same transaction. See `AI_HANDOFF.md` for the dated status and next steps.

## Run locally

From the repository root in PowerShell:

```powershell
npm run dev
```

This starts the API on port 3000 and the Vite frontend on port 5173. If Vite reports
`ECONNREFUSED` for proxied `/auth/*` requests, start the API (`npm run dev:server`)
or restart both services with `npm run dev`. Check API availability at
`http://127.0.0.1:3000/health`.

## Decision history

The supplied starter documents proposed PostgreSQL, Docker, CI, and a security-review project. The learner selected a locally installed MySQL server and explicitly clarified that this is not a real-life deployment. This documentation therefore treats MySQL as the database choice, and production infrastructure as optional learning/stretch work. Password reset and other account lifecycle flows remain in scope. Email, payment processing, and deployment integrations remain local/mock or out of scope.
