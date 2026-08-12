-- CreateTable
CREATE TABLE "employee_exits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "exitType" TEXT NOT NULL DEFAULT 'RESIGNATION',
    "resignation_date" DATE,
    "last_working_day" DATE NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "ctc_monthly" DECIMAL(12,2),
    "pending_salary_days" DECIMAL(6,2),
    "pending_salary_amount" DECIMAL(12,2),
    "adjustments" JSONB,
    "net_settlement" DECIMAL(12,2),
    "settlement_notes" TEXT,
    "settlement_pdf_path" TEXT,
    "settled_at" TIMESTAMP(3),
    "initiated_by" TEXT,
    "settled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_exits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_exits_employee_id_key" ON "employee_exits"("employee_id");

-- CreateIndex
CREATE INDEX "employee_exits_tenant_id_status_idx" ON "employee_exits"("tenant_id", "status");
