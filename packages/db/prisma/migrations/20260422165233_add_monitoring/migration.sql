-- CreateEnum
CREATE TYPE "TimeLogSource" AS ENUM ('MANUAL', 'DESKTOP_AGENT', 'BROWSER_EXTENSION', 'API');

-- CreateTable
CREATE TABLE "time_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "clock_in" TIMESTAMP(3) NOT NULL,
    "clock_out" TIMESTAMP(3),
    "duration" INTEGER,
    "source" "TimeLogSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "screenshot_url" TEXT,
    "thumbnail_url" TEXT,
    "activity_percent" INTEGER NOT NULL DEFAULT 0,
    "keystrokes" INTEGER NOT NULL DEFAULT 0,
    "mouseClicks" INTEGER NOT NULL DEFAULT 0,
    "mouse_movements" INTEGER NOT NULL DEFAULT 0,
    "active_app" TEXT,
    "active_url" TEXT,
    "active_title" TEXT,
    "is_idle" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_date_idx" ON "time_logs"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_employee_id_idx" ON "time_logs"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "time_logs_tenant_id_employee_id_date_idx" ON "time_logs"("tenant_id", "employee_id", "date");

-- CreateIndex
CREATE INDEX "activity_snapshots_tenant_id_employee_id_captured_at_idx" ON "activity_snapshots"("tenant_id", "employee_id", "captured_at");

-- CreateIndex
CREATE INDEX "activity_snapshots_tenant_id_captured_at_idx" ON "activity_snapshots"("tenant_id", "captured_at");

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_logs" ADD CONSTRAINT "time_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_snapshots" ADD CONSTRAINT "activity_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_snapshots" ADD CONSTRAINT "activity_snapshots_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
