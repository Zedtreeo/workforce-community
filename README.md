# Zedtreeo Workforce — Community Edition

<!-- Badges (add once repo is live): AGPL-3.0 · CI · GitHub stars · Docker pulls -->
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](./LICENSE)

The **free, open-source, self-hostable** edition of **Zedtreeo Workforce** — a modern HRMS for small and mid-size teams. Run your own people, attendance, leave, payroll, onboarding, and client billing platform.

> 🌐 **Hosted version, Pro features & priority support →** **[zedtreeo.com](https://zedtreeo.com)**
> 🟢 **Live demo →** **https://demo.zedtreeo.io/login**
> 🐳 **Docker images →** [`workforce-community-api`](https://hub.docker.com/r/zedtreeo1/workforce-community-api) · [`workforce-community-web`](https://hub.docker.com/r/zedtreeo1/workforce-community-web)

---

## ✨ Features (Community Edition)

- 👥 **Employees, departments & org directory**
- 🕘 **Attendance** — web clock-in/out & shifts
- 🌴 **Leave management** & holiday calendar
- 💰 **Payroll** — pay structures, runs, payslip PDFs
- 📝 **Onboarding** — offer letters + e-signature upload
- 🧾 **Clients & basic invoicing**
- 🔐 **Role-based access control** (access profiles)
- 🙋 **Self-service portals** for employees & clients
- 📚 **Knowledge base**

### Community vs Pro

| | Community (free, self-host) | Pro / Cloud ([zedtreeo.com](https://zedtreeo.com)) |
|---|:---:|:---:|
| Core HRMS (above) | ✅ | ✅ |
| AI HR & Billing Assistant | — | ✅ |
| Calling / Chat / Groups | — | ✅ |
| Tax-grade payroll (TDS, Form 16/24Q/26Q, arrears) | — | ✅ |
| Appraisal cycles → auto pay-revisions | — | ✅ |
| Multi-entity & advanced invoicing | — | ✅ |
| Managed hosting + priority support | — | ✅ |

---

## 🚀 Quick start (one command)

```bash
git clone https://github.com/Zedtreeo/workforce-community
cd workforce-community
cp .env.example .env
docker compose up
```

**Faster (skip the build)** — pull the prebuilt images from Docker Hub:

```bash
docker compose pull && docker compose up -d
```

Images: [`zedtreeo1/workforce-community-api`](https://hub.docker.com/r/zedtreeo1/workforce-community-api) · [`zedtreeo1/workforce-community-web`](https://hub.docker.com/r/zedtreeo1/workforce-community-web)

Open **http://localhost:3000** → enter `admin@demo.com`. Login is a one-time
code sent by email — with the bundled Mailpit mail-catcher, grab it from the
inbox at **http://localhost:8025**. (Demo data — a synthetic company, employees,
attendance, leave, payroll, clients & invoices — is seeded automatically.)

Demo data (a synthetic company, employees, attendance, leave, payroll, clients & invoices) is seeded automatically on first boot.

## 🧱 Tech stack

NestJS · Next.js 14 (App Router) · Prisma · PostgreSQL 16 · Redis · MinIO (S3)

## 🤝 Contributing

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). A lightweight **CLA** is required so the project can be dual-licensed.

## 📄 License

**AGPL-3.0** — see [LICENSE](./LICENSE). Building a commercial/SaaS product, or want it without AGPL obligations? See **[COMMERCIAL.md](./COMMERCIAL.md)**.

## 💬 Support

- **Community:** [GitHub issues](https://github.com/zedtreeo/workforce-community/issues) (best-effort)
- **Priority support & managed hosting:** **[zedtreeo.com](https://zedtreeo.com)**

---

Built by **[Chandra Prakash](https://cpchander.com)** with **[Claude (Anthropic)](https://www.anthropic.com)**.
A **[Zedtreeo](https://zedtreeo.com)** project — © Zedtreeo. Licensed under AGPL-3.0.
