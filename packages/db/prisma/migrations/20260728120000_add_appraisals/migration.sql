-- Appraisal module: annual salary-review cycles keyed to the join anniversary.

-- New notification types for the appraisal workflow
ALTER TYPE "NotificationType" ADD VALUE 'APPRAISAL_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'APPRAISAL_SELF_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'APPRAISAL_MANAGER_REVIEW';
ALTER TYPE "NotificationType" ADD VALUE 'APPRAISAL_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'APPRAISAL_APPLIED';

-- Appraisal lifecycle status
CREATE TYPE "AppraisalStatus" AS ENUM (
    'DUE',
    'SELF_REVIEW',
    'MANAGER_REVIEW',
    'PENDING_APPROVAL',
    'APPROVED',
    'APPLIED',
    'SKIPPED',
    'REJECTED'
);

-- One appraisal cycle per employee per anniversary year
CREATE TABLE "appraisal_cycles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "cycle_year" INTEGER NOT NULL,
    "cycle_number" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "AppraisalStatus" NOT NULL DEFAULT 'DUE',
    "current_ctc_annual" DECIMAL(14,2),
    "current_ctc_monthly" DECIMAL(12,2),
    "self_rating" INTEGER,
    "self_comments" TEXT,
    "self_submitted_at" TIMESTAMP(3),
    "manager_id" TEXT,
    "manager_rating" INTEGER,
    "manager_comments" TEXT,
    "recommended_hike_pct" DECIMAL(6,2),
    "recommended_ctc_annual" DECIMAL(14,2),
    "manager_submitted_at" TIMESTAMP(3),
    "new_ctc_annual" DECIMAL(14,2),
    "new_ctc_monthly" DECIMAL(12,2),
    "hike_pct" DECIMAL(6,2),
    "effective_from" DATE,
    "admin_comments" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "applied_assignment_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "arrear_amount" DECIMAL(14,2),
    "arrear_breakdown" JSONB,
    "arrear_payroll_run_id" TEXT,
    "arrear_applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appraisal_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appraisal_cycles_tenant_id_employee_id_cycle_year_key" ON "appraisal_cycles"("tenant_id", "employee_id", "cycle_year");
CREATE INDEX "appraisal_cycles_tenant_id_status_idx" ON "appraisal_cycles"("tenant_id", "status");
CREATE INDEX "appraisal_cycles_tenant_id_employee_id_idx" ON "appraisal_cycles"("tenant_id", "employee_id");

ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appraisal_cycles" ADD CONSTRAINT "appraisal_cycles_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Per-tenant appraisal trigger config
CREATE TABLE "appraisal_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "auto_create" BOOLEAN NOT NULL DEFAULT true,
    "interval_months" INTEGER NOT NULL DEFAULT 12,
    "lead_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appraisal_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "appraisal_settings_tenant_id_key" ON "appraisal_settings"("tenant_id");

ALTER TABLE "appraisal_settings" ADD CONSTRAINT "appraisal_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
