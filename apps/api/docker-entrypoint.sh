#!/bin/sh
set -e

echo "==> Running Prisma migrations..."
cd /app/packages/db
npx prisma migrate deploy --schema=./prisma/schema.prisma
cd /app

echo "==> Starting HRMS API..."
exec node apps/api/dist/main.js
