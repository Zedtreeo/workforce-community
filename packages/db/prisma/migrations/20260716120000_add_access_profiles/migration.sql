-- Named access profiles: base role + module scopes, assignable to users.
CREATE TABLE "access_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "scopes" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "access_profiles_tenant_id_name_key" ON "access_profiles"("tenant_id", "name");
CREATE INDEX "access_profiles_tenant_id_idx" ON "access_profiles"("tenant_id");

ALTER TABLE "users" ADD COLUMN "access_profile_id" TEXT;
CREATE INDEX "users_access_profile_id_idx" ON "users"("access_profile_id");
ALTER TABLE "users" ADD CONSTRAINT "users_access_profile_id_fkey"
    FOREIGN KEY ("access_profile_id") REFERENCES "access_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the five system profiles for every existing tenant.
INSERT INTO "access_profiles" ("id", "tenant_id", "name", "description", "base_role", "scopes", "is_system", "updated_at")
SELECT 'ap_' || substr(md5(t.id || p.name), 1, 21), t.id, p.name, p.description, p.base_role::"UserRole", p.scopes::jsonb, true, CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (VALUES
    ('Admin', 'Full administrative access to every module', 'ADMIN', NULL),
    ('Manager', 'People management: employees, attendance, leaves, clients and reports — no admin-only modules', 'MANAGER', NULL),
    ('Employee', 'Self-service portal only (attendance, leaves, payslips, profile)', 'MEMBER',
     '{"mode":"deny","modules":["dashboard","attendance","letters","departments","reports","monitoring","documents"]}'),
    ('Viewer', 'Read-only visibility: dashboard and reports', 'VIEWER',
     '{"mode":"allow","modules":["dashboard","reports"]}'),
    ('Billing', 'Invoicing work only: invoices, clients, assignments, client portal and the billing report', 'ADMIN',
     '{"mode":"allow","modules":["dashboard","invoices","clients","assignments","client-portal","reports/billing"]}')
) AS p(name, description, base_role, scopes)
ON CONFLICT ("tenant_id", "name") DO NOTHING;

-- Auto-assign profiles to existing users by role — but only users WITHOUT
-- a per-user override (module_scopes stays the stronger, custom setting).
UPDATE "users" u
SET "access_profile_id" = ap.id
FROM "access_profiles" ap
WHERE ap."tenant_id" = u."tenant_id"
  AND ap."is_system" = true
  AND u."access_profile_id" IS NULL
  AND u."module_scopes" IS NULL
  AND ap."name" = CASE u."role"
      WHEN 'ADMIN' THEN 'Admin'
      WHEN 'OWNER' THEN 'Admin'
      WHEN 'MANAGER' THEN 'Manager'
      WHEN 'MEMBER' THEN 'Employee'
      WHEN 'VIEWER' THEN 'Viewer'
    END;
