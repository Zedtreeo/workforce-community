#!/bin/sh
set -e

echo "==> Running Prisma migrations..."
cd /app/packages/db
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Seed synthetic demo data on first boot when SEED_DEMO=true (idempotent).
if [ "$SEED_DEMO" = "true" ]; then
  echo "==> Seeding demo data..."
  npx tsx prisma/seed.ts || echo "==> (seed skipped/failed — continuing)"
fi

cd /app
echo "==> Starting Zedtreeo Workforce API..."
exec node apps/api/dist/main.js
