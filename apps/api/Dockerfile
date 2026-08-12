# ─── HRMS API — Production Dockerfile ───────────────────

# ── Stage 1: Dependencies ───────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile
RUN pnpm approve-builds sharp 2>/dev/null || true
RUN pnpm rebuild sharp 2>/dev/null || true

# ── Stage 2: Build ──────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY packages/db/ packages/db/
COPY apps/api/ apps/api/

RUN cd packages/db && npx prisma generate
RUN cd apps/api && pnpm run build

# ── Stage 3: Production ────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat openssl dumb-init vips
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

RUN addgroup --system --gid 1001 hrms && \
    adduser --system --uid 1001 hrms

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile --prod
RUN pnpm rebuild sharp 2>/dev/null || true

# Prisma schema + migrations
COPY --from=build /app/packages/db/prisma ./packages/db/prisma

# Generate Prisma client in production node_modules
RUN cd packages/db && npx prisma generate

# Compiled API
COPY --from=build /app/apps/api/dist ./apps/api/dist

# Entrypoint (runs migrations then starts)
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/uploads && chown -R hrms:hrms /app
USER hrms

ENV NODE_ENV=production
ENV API_PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["docker-entrypoint.sh"]


