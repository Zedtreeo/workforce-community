-- Employee codes use the "LE" prefix (e.g. LE1178), continuing the existing
-- directory sequence. Flip the default and any rows still on the old "EMP".

ALTER TABLE "tenant_letter_settings" ALTER COLUMN "employee_code_prefix" SET DEFAULT 'LE';
UPDATE "tenant_letter_settings" SET "employee_code_prefix" = 'LE' WHERE "employee_code_prefix" = 'EMP';
