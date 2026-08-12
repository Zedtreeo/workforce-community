-- CreateTable
CREATE TABLE "monthly_attendance_overrides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "working_days" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "timeoff" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "over_time" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "late_count" INTEGER NOT NULL DEFAULT 0,
    "early_count" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'UPLOAD',
    "uploaded_by" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monthly_attendance_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "monthly_attendance_overrides_tenant_id_employee_id_year_month_key" ON "monthly_attendance_overrides"("tenant_id", "employee_id", "year", "month");

-- CreateIndex
CREATE INDEX "monthly_attendance_overrides_tenant_id_year_month_idx" ON "monthly_attendance_overrides"("tenant_id", "year", "month");

-- AddForeignKey
ALTER TABLE "monthly_attendance_overrides" ADD CONSTRAINT "monthly_attendance_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_attendance_overrides" ADD CONSTRAINT "monthly_attendance_overrides_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
