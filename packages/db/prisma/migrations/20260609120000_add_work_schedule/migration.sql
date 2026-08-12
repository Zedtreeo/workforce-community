-- CreateEnum
CREATE TYPE "WorkSchedule" AS ENUM ('FULL_TIME', 'PART_TIME');

-- AlterTable
ALTER TABLE "employee_assignments"
  ADD COLUMN "work_schedule" "WorkSchedule" NOT NULL DEFAULT 'FULL_TIME';
