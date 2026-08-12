-- Company contact info on the tenant (shown in portals + settings)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "address" TEXT;
