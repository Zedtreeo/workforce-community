# Contributing to Zedtreeo Workforce CE

Thanks for your interest! Contributions are welcome.

## Ground rules
- **CLA required.** By submitting a PR you agree to the Contributor License
  Agreement (the CLA bot will prompt you on your first PR). This lets the project
  stay dual-licensed (AGPL + commercial).
- Keep PRs focused. Discuss large changes in an issue first.
- The maintainers curate the roadmap — not every PR will be merged.

## Dev setup
```bash
cp .env.example .env
docker compose up        # full stack: postgres, redis, minio, mailpit, api, web
```
- API: NestJS (`apps/api`) · Web: Next.js (`apps/web`) · DB: Prisma (`packages/db`)
- Run checks before pushing:
  ```bash
  pnpm --filter api typecheck && pnpm --filter web typecheck
  pnpm --filter api test
  ```

## Reporting bugs / requesting features
Open a GitHub issue with clear steps to reproduce. Have a feature idea or general
feedback? Open an issue or email **support@zedtreeo.com**. For security issues,
see [SECURITY.md](./SECURITY.md) — do **not** file a public issue.

## Scope
This is the **Community Edition**. Pro features (AI assistant, calling/chat,
tax-grade payroll, appraisals) live in the commercial product and are out of
scope here — see [COMMERCIAL.md](./COMMERCIAL.md).

---
A [Zedtreeo](https://zedtreeo.com) project · [Chandra Prakash](https://cpchander.com) + Claude (Anthropic).
