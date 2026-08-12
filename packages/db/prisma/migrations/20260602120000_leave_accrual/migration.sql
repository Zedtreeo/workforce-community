ALTER TABLE "leave_balances" ALTER COLUMN "entitled" TYPE DECIMAL(6,2);
ALTER TABLE "leave_balances" ALTER COLUMN "used" TYPE DECIMAL(6,2);
ALTER TABLE "leave_balances" ALTER COLUMN "carried_over" TYPE DECIMAL(6,2);
ALTER TABLE "leave_balances" ALTER COLUMN "adjustment" TYPE DECIMAL(6,2);
ALTER TABLE "employee_assignments" ADD COLUMN "accrued_leave_months" INTEGER NOT NULL DEFAULT 0;
