-- CreateEnum
CREATE TYPE "PayHeadType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "PayHeadCategory" AS ENUM ('FIXED', 'VARIABLE', 'STATUTORY');

-- CreateEnum
CREATE TYPE "StatutoryType" AS ENUM ('PF', 'ESI', 'PT', 'GRATUITY', 'TDS');

-- CreateEnum
CREATE TYPE "RoundingMode" AS ENUM ('NORMAL', 'FLOOR', 'CEILING', 'NONE');

-- CreateTable
CREATE TABLE "pay_heads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PayHeadType" NOT NULL,
    "category" "PayHeadCategory" NOT NULL DEFAULT 'FIXED',
    "description" TEXT,
    "is_statutory" BOOLEAN NOT NULL DEFAULT false,
    "statutory_type" "StatutoryType",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_heads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_structure_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "effective_from" DATE,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_structure_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_structure_components" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "head_id" TEXT NOT NULL,
    "formula" TEXT,
    "formula_display" TEXT,
    "is_variable" BOOLEAN NOT NULL DEFAULT false,
    "show_on_payslip" BOOLEAN NOT NULL DEFAULT true,
    "has_arrear" BOOLEAN NOT NULL DEFAULT false,
    "has_incr_pct" BOOLEAN NOT NULL DEFAULT false,
    "affects_pf" BOOLEAN NOT NULL DEFAULT false,
    "affects_esi" BOOLEAN NOT NULL DEFAULT false,
    "affects_pt" BOOLEAN NOT NULL DEFAULT false,
    "affects_gratuity" BOOLEAN NOT NULL DEFAULT false,
    "rounding_mode" "RoundingMode" NOT NULL DEFAULT 'NORMAL',
    "rounding_precision" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_structure_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pay_structure_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "ctc_annual" DECIMAL(14,2),
    "ctc_monthly" DECIMAL(12,2),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_structure_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_lines" (
    "id" TEXT NOT NULL,
    "payslip_id" TEXT NOT NULL,
    "head_id" TEXT NOT NULL,
    "head_name" TEXT NOT NULL,
    "head_type" "PayHeadType" NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "arrear_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "formula" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "show_on_payslip" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payslip_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pay_heads_tenant_id_type_idx" ON "pay_heads"("tenant_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "pay_heads_tenant_id_code_key" ON "pay_heads"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "pay_structure_templates_tenant_id_idx" ON "pay_structure_templates"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_structure_templates_tenant_id_name_key" ON "pay_structure_templates"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "pay_structure_components_template_id_idx" ON "pay_structure_components"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "pay_structure_components_template_id_head_id_key" ON "pay_structure_components"("template_id", "head_id");

-- CreateIndex
CREATE INDEX "pay_structure_assignments_tenant_id_employee_id_idx" ON "pay_structure_assignments"("tenant_id", "employee_id");

-- CreateIndex
CREATE INDEX "pay_structure_assignments_tenant_id_is_active_idx" ON "pay_structure_assignments"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "payslip_lines_payslip_id_idx" ON "payslip_lines"("payslip_id");

-- CreateIndex
CREATE INDEX "clients_tenant_id_is_active_idx" ON "clients"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "clients_tenant_id_deleted_at_idx" ON "clients"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "departments_tenant_id_deleted_at_idx" ON "departments"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "employees_tenant_id_department_id_idx" ON "employees"("tenant_id", "department_id");

-- CreateIndex
CREATE INDEX "employees_tenant_id_deleted_at_idx" ON "employees"("tenant_id", "deleted_at");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_due_date_idx" ON "invoices"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_type_idx" ON "notifications"("tenant_id", "type");

-- AddForeignKey
ALTER TABLE "pay_heads" ADD CONSTRAINT "pay_heads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_templates" ADD CONSTRAINT "pay_structure_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pay_structure_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_components" ADD CONSTRAINT "pay_structure_components_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "pay_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_assignments" ADD CONSTRAINT "pay_structure_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_assignments" ADD CONSTRAINT "pay_structure_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pay_structure_assignments" ADD CONSTRAINT "pay_structure_assignments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "pay_structure_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_head_id_fkey" FOREIGN KEY ("head_id") REFERENCES "pay_heads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
