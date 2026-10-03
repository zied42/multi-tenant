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

These documents describe both the **target learning project** and the **current implementation**. The current implementation is early: Express infrastructure and basic register/login/current-user authentication exist; most business module files are still stubs. See `AI_HANDOFF.md` for a dated status snapshot. A planned endpoint or security control is not complete merely because it appears in these docs.

## Decision history

The supplied starter documents proposed PostgreSQL, Docker, CI, and a security-review project. The learner selected a locally installed MySQL server and explicitly clarified that this is not a real-life deployment. This documentation therefore treats MySQL as the database choice, and production infrastructure as optional learning/stretch work. Password reset and other account lifecycle flows remain in scope.
