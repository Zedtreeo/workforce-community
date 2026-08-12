-- Employee "reporting manager" self-relation (who this employee reports to)
ALTER TABLE "employees" ADD COLUMN "reporting_manager_id" TEXT;

ALTER TABLE "employees"
  ADD CONSTRAINT "employees_reporting_manager_id_fkey"
  FOREIGN KEY ("reporting_manager_id") REFERENCES "employees"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
