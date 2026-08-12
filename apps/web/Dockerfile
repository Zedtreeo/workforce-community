# ─── HRMS Web — Production Dockerfile ───────────────────

# ── Stage 1: Dependencies ───────────────────────────────
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ──────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY packages/ packages/
COPY apps/web/ apps/web/

RUN cd packages/db && npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
RUN cd apps/web && pnpm run build

# ── Stage 3: Production ────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

RUN addgroup --system --gid 1001 hrms && \
    adduser --system --uid 1001 hrms

COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

RUN chown -R hrms:hrms /app
USER hrms

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
