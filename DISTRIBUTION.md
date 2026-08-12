# Distribution & Backlink Checklist — Zedtreeo Workforce CE

Working tracker for launching the Community Edition and earning backlinks to **[zedtreeo.com](https://zedtreeo.com)**.
Fill **Status** (`todo` / `submitted` / `live`), the **URL** once listed, and **Link** (`dofollow` / `nofollow`).

> **SEO reality check:** GitHub README/profile links are mostly `nofollow`. The real ranking value comes from **Tier-1/2 directories** and **people writing about the project**. GitHub is for discovery, stars & forks — not direct link juice.
> **The link loop:** repo → `zedtreeo.com/community` (canonical) → repo; blog posts → both.

---

## 0. Canonical target (do this first)
- [ ] Publish **`zedtreeo.com/community`** landing page (the page everything points to) — screenshots, feature list, "Star on GitHub" + "Book a demo" CTAs.
- [ ] Add "Open-source Community Edition available" note + repo link to the existing product pages.

## 1. Code hosting & mirrors
| Platform | Status | URL | Notes |
|---|---|---|---|
| GitHub org `zedtreeo` + repo `workforce-community` (primary) | todo | | claim org first |
| GitLab mirror | todo | | auto-push mirror |
| Codeberg mirror | todo | | community goodwill |

## 2. Package / image registries (install + listing)
| Platform | Status | URL | Notes |
|---|---|---|---|
| Docker Hub `zedtreeo/workforce-*` | todo | | description links back |
| GitHub Container Registry (GHCR) | todo | | via CI |

## 3. Tier 1 — self-host / OSS directories (highest leverage, dofollow)
| Platform | Status | URL | Link | Notes |
|---|---|---|---|---|
| awesome-selfhosted (PR) | todo | | dofollow | best single selfhost backlink |
| AlternativeTo | todo | | | list as alt to BambooHR/Zoho People |
| OpenAlternative (openalternative.co) | todo | | dofollow | |
| selfh.st | todo | | | newsletter + directory |
| LibHunt | todo | | | |
| SaaSHub | todo | | | |

## 4. Deploy catalogs (dofollow + real installs)
| Platform | Status | URL | Notes |
|---|---|---|---|
| Coolify (add to catalog / one-click) | todo | | |
| PikaPods | todo | | |
| Elestio | todo | | |
| Railway template | todo | | |
| Render blueprint | todo | | |
| CapRover one-click | todo | | |

## 5. Tier 2 — business-software directories (high authority)
| Platform | Status | URL | Notes |
|---|---|---|---|
| G2 | **live (product)** | | ✏️ add "free open-source CE" + repo link |
| Capterra | **live (product)** | | ✏️ add CE note + link |
| GetApp (Gartner network — same as Capterra) | todo | | claim via Capterra network |
| Software Advice (Gartner network) | todo | | claim via Capterra network |
| Slant | todo | | |
| StackShare | todo | | |
| Product Hunt (launch) | todo | | time with polish done |

## 6. Content that earns links (the real engine)
| Item | Status | URL | Notes |
|---|---|---|---|
| Blog: "We open-sourced our HRMS — self-host in 5 min" (on zedtreeo.com) | todo | | SEO anchor |
| dev.to repost (canonical → blog) | todo | | |
| Hashnode repost (canonical → blog) | todo | | |
| Medium repost (canonical → blog) | todo | | |
| Show HN | todo | | |
| r/selfhosted | todo | | |
| r/opensource | todo | | |
| r/smallbusiness | todo | | |
| Indie Hackers | todo | | |
| LinkedIn post | todo | | |

## 7. Pre-launch credibility (before promoting)
- [ ] 5–10 stars from network (don't launch to an empty repo)
- [ ] A few good README screenshots / hero GIF
- [ ] 2–3 closed issues + a filled-in roadmap
- [ ] `gitleaks` / `trufflehog` scan passes clean
- [ ] Live demo up and stable

---

Maintained by **[Chandra Prakash](https://cpchander.com)** · assisted by **Claude (Anthropic)** · a **[Zedtreeo](https://zedtreeo.com)** project.
