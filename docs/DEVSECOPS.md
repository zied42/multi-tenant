# DevSecOps learning plan

This plan is a later learning phase. The project now has a focused auth refresh integration suite and frontend build, but no Docker setup or CI workflow. Do not present the planned controls below as already enabled.

## Local development checks

Current commands:

```powershell
npm run dev
npm run typecheck
npm test
npm --prefix web run build
```

Run `npm run dev` from the repository root to start the API and Vite together
(`concurrently`). Vite listens on port 5173 and proxies `/api` to `127.0.0.1:3000`.
If proxy requests fail with `ECONNREFUSED`, confirm the API process is alive with
`Invoke-RestMethod http://127.0.0.1:3000/health` or start `npm run dev:server`.

`npm test` exercises refresh coordination and replay handling against the MySQL database in `DATABASE_URL`; it creates and deletes a uniquely named test user. Use a disposable database when the configured database contains data to preserve. The suite is focused, not broad coverage of the entire application.

## Proposed sequence

1. Expand focused tests to cover registration, password reset, email verification, permission policy, tenant isolation, invitations, and checkout. The existing automated suite is focused on refresh coordination/replay and does not validate every implemented module.
2. Reconcile the target and current API before writing authorization/state-machine assertions: audit access roles differ, and the PRD's `DELIVERED` state is not in the current order enum.
3. Make mock-payment/order-note writes and their audit records transactional if preserving the PRD audit atomicity requirement.
4. Verify a clean install/build/migration on a separate test database.
5. Run `npm audit` and inspect advisories; update dependencies intentionally rather than approving every install script broadly.
6. Add a GitHub Actions workflow for install, Prisma generation/migration validation, typecheck, build, and tests.
7. Add secret scanning (e.g. Gitleaks), static analysis (Semgrep or CodeQL), and dependency checks.
8. Add a container only if the learner wants Docker as a separate lesson; run as non-root and keep secrets out of image layers.
9. Consider a local DAST exercise against a disposable instance only after routes/tests exist.

## CI target (aspirational)

For pull requests: clean dependency install, Prisma schema/migration validation, typecheck, build, automated tests, and high-severity dependency audit. Later add secret scan and static analysis. Pin third-party GitHub Actions versions/SHAs when building the workflow.

## Repository hygiene

- `.env` and secrets must stay untracked; commit `.env.example` with placeholders only.
- Never paste local root DB credentials, JWT secret, reset tokens, or real customer data into docs/commits/logs.
- Use a separate disposable test DB for automated tests; never point destructive test setup at the learning database unintentionally.
- Keep migration files under version control. Do not manually edit an applied migration to change schema history; add a new migration.

## Later security portfolio exercise (optional)

The supplied DEVSECOPS document proposed deliberately vulnerable feature builds and a full SAST/DAST/container pipeline. That can be a separate advanced exercise, but the human asked for a functioning learning app and is not building this for production. First finish understandable features and regression tests. Do not intentionally ship vulnerabilities or deploy a deliberately vulnerable version publicly.
