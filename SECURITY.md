# Security Policy

## Reporting a vulnerability
Please **do not** open a public issue for security problems.

Email **security@zedtreeo.com** (or use GitHub's private "Report a vulnerability"
feature). Include steps to reproduce and impact. We aim to acknowledge within a
few business days.

## Supported versions
Security fixes land on the latest release. Please run a current version before
reporting.

## Self-hosting hardening (quick notes)
- Change every value in `.env` from the defaults — especially `BETTER_AUTH_SECRET`
  and database/MinIO credentials.
- Do not expose Postgres, Redis, MinIO, or Mailpit ports to the public internet.
- Put the app behind TLS (a reverse proxy such as Caddy/Traefik/nginx).
- Turn **off** `DEMO_MODE` / `SEED_DEMO` for any real deployment.

---
A [Zedtreeo](https://zedtreeo.com) project.
