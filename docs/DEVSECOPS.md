# DevSecOps learning plan

This plan is a later learning phase. The project currently has no meaningful test suite, build pipeline, Docker setup, or CI workflow. Do not present the planned controls below as already enabled.

## Local development checks

Current commands:

```powershell
npm run dev
npm run typecheck
```

`npm test` remains the starter placeholder and must be replaced before anyone relies on it. Add tests deliberately after the corresponding code and concepts are understood.

## Proposed sequence

1. Add a real test runner and focused tests for auth, permission policy, tenant isolation, and checkout.
2. Add build script and verify a clean install/build/migration on a separate test database.
3. Run `npm audit` and inspect advisories; update dependencies intentionally rather than approving every install script broadly.
4. Add a GitHub Actions workflow for install, Prisma generation/migration validation, typecheck, build, and tests.
5. Add secret scanning (e.g. Gitleaks), static analysis (Semgrep or CodeQL), and dependency checks.
6. Add a container only if the learner wants Docker as a separate lesson; run as non-root and keep secrets out of image layers.
7. Consider a local DAST exercise against a disposable instance only after routes/tests exist.

## CI target (aspirational)

For pull requests: clean dependency install, Prisma schema/migration validation, typecheck, build, automated tests, and high-severity dependency audit. Later add secret scan and static analysis. Pin third-party GitHub Actions versions/SHAs when building the workflow.

## Repository hygiene

- `.env` and secrets must stay untracked; commit `.env.example` with placeholders only.
- Never paste local root DB credentials, JWT secret, reset tokens, or real customer data into docs/commits/logs.
- Use a separate disposable test DB for automated tests; never point destructive test setup at the learning database unintentionally.
- Keep migration files under version control. Do not manually edit an applied migration to change schema history; add a new migration.

## Later security portfolio exercise (optional)

The supplied DEVSECOPS document proposed deliberately vulnerable feature builds and a full SAST/DAST/container pipeline. That can be a separate advanced exercise, but the human asked for a functioning learning app and is not building this for production. First finish understandable features and regression tests. Do not intentionally ship vulnerabilities or deploy a deliberately vulnerable version publicly.
