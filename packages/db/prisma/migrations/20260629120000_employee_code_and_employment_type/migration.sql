-- Auto employee-code prefix + offer-letter employment type (Full/Part Time)

ALTER TABLE "tenant_letter_settings"
  ADD COLUMN IF NOT EXISTS "employee_code_prefix" TEXT NOT NULL DEFAULT 'EMP';

ALTER TABLE "offer_letters"
  ADD COLUMN IF NOT EXISTS "employment_type" "WorkSchedule" NOT NULL DEFAULT 'FULL_TIME';
