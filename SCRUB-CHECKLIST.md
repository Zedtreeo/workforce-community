# Phase 1 — Extraction / Strip / Scrub Checklist

How to build the clean Community Edition **from scratch** (never by pushing the private repo). Copy modules over deliberately; strip everything below.

## A. Fresh history (non-negotiable)
- [ ] New empty repo, brand-new git history. Do **not** `git clone`/mirror the private repo.
- [ ] Copy source **as files** (not git history) into this scaffold.
- [ ] Run **`gitleaks detect`** and **`trufflehog filesystem .`** before the first public push — must be clean.

## B. Modules to INCLUDE (CE)
employees · departments · attendance · shifts · leave · holidays · payroll (basic) · onboarding + letters (offer) · clients · invoices (basic) · rbac/access-profiles · portal (employee + client) · knowledge-base (basic)

## C. Modules to STRIP (Pro — remove entirely, code + routes + schema + web pages)
- [ ] `agent` (AI assistant) + Anthropic deps/keys
- [ ] `calling` / `messages` / `groups` (LiveKit) + LiveKit keys
- [ ] Tax-grade payroll: TDS reports, Form 16/24Q/26Q, tax-forms, arrears
- [ ] `appraisals`
- [ ] Multi-billing-entity + advanced invoicing extras
- [ ] PWA push (VAPID), virtual backgrounds
- [ ] `troubleshoot` console
- [ ] `monitoring` (dormant desktop-agent surface) + `apps/agent`
- [ ] Prune the Prisma schema of the removed models; regenerate + a fresh initial migration.

## D. Secrets & infra to REMOVE
- [ ] All real env/keys: DATABASE_URL, BETTER_AUTH_SECRET, SMTP/ZeptoMail, ANTHROPIC_API_KEY, VAPID, LiveKit, Carbone, MinIO creds, VPS IPs/hostnames.
- [ ] `run-api.sh` / `deploy-web.sh` / any prod deploy scripts.
- [ ] Ship only `.env.example` with safe placeholders.

## E. Branding & data to GENERICIZE
- [ ] Remove "Legelp"/"LegelpTech" strings; replace with neutral defaults.
- [ ] Replace letter templates (offer/appointment/agreement) with generic samples (no client names/logos).
- [ ] Remove any real client/employee data; ship only the synthetic seed.
- [ ] Confirm asset licenses (fonts, icons, MediaPipe, pdfkit, **Carbone** ← check license / swap if needed) are AGPL-compatible.

## F. Self-host packaging
- [ ] `docker-compose.yml`: postgres + redis + minio + mailpit + api + web (see scaffold).
- [ ] First-boot: auto `prisma migrate deploy` + `SEED_DEMO=true` seed.
- [ ] Demo mode: fixed OTP + seeded `admin@demo.local`.
- [ ] Publish images to Docker Hub + GHCR via CI.

## G. Synthetic demo seed
- [ ] Adapt the existing demo ("TechNova") seed → ~20 employees, departments, 2–3 months attendance/leave, holidays, a payroll run, 3–4 clients + invoices, 1 in-progress onboarding.
- [ ] Idempotent; gated by `SEED_DEMO`.

## H. Polish (Phase 3)
- [ ] README screenshots/GIFs (capture from the running demo).
- [ ] CI (lint/typecheck/test — reuse the fixed workflow pattern).
- [ ] LICENSE full text, COMMERCIAL, CONTRIBUTING + CLA, SECURITY, issue/PR templates.
- [x] Hosted demo live at https://demo.zedtreeo.io/login.

---
A [Zedtreeo](https://zedtreeo.com) project · [Chandra Prakash](https://cpchander.com) + Claude (Anthropic).
