-- Client portal: explicit per-client toggle + email-OTP auth fields

-- Per-client portal access toggle
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "portal_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Portal users move from password to email OTP
ALTER TABLE "client_portal_users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "client_portal_users" ADD COLUMN IF NOT EXISTS "otp_hash" TEXT;
ALTER TABLE "client_portal_users" ADD COLUMN IF NOT EXISTS "otp_expires_at" TIMESTAMP(3);
ALTER TABLE "client_portal_users" ADD COLUMN IF NOT EXISTS "otp_attempts" INTEGER NOT NULL DEFAULT 0;
