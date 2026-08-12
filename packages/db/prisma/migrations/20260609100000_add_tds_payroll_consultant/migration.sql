-- CreateEnum
CREATE TYPE "ItDeclarationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('NEW', 'OLD');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('EMPLOYEE', 'CONSULTANT');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "tan_number" TEXT;

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "consultant_tds_rate" DECIMAL(5,2) NOT NULL DEFAULT 2,
ADD COLUMN     "engagement_type" "EngagementType" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "tax_regime" "TaxRegime" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "payslips" ADD COLUMN     "tds_breakdown" JSONB;

-- CreateTable
CREATE TABLE "tax_slabs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL,
    "financial_year" TEXT NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "to_amount" DECIMAL(12,2),
    "rate_pct" DECIMAL(5,2) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_slabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_regime_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL,
    "financial_year" TEXT NOT NULL,
    "standard_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "rebate_max_taxable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cess_pct" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_regime_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "it_declarations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "financial_year" TEXT NOT NULL,
    "regime" "TaxRegime" NOT NULL DEFAULT 'OLD',
    "status" "ItDeclarationStatus" NOT NULL DEFAULT 'DRAFT',
    "sec_80c" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80ccd1b" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80d" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80e" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80g" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sec_80tta" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "home_loan_interest" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hra_rent_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "metro_city" BOOLEAN NOT NULL DEFAULT false,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "it_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_slabs_tenant_id_regime_financial_year_idx" ON "tax_slabs"("tenant_id", "regime", "financial_year");

-- CreateIndex
CREATE UNIQUE INDEX "tax_regime_configs_tenant_id_regime_financial_year_key" ON "tax_regime_configs"("tenant_id", "regime", "financial_year");

-- CreateIndex
CREATE INDEX "it_declarations_tenant_id_status_idx" ON "it_declarations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "it_declarations_tenant_id_employee_id_financial_year_key" ON "it_declarations"("tenant_id", "employee_id", "financial_year");

-- AddForeignKey
ALTER TABLE "it_declarations" ADD CONSTRAINT "it_declarations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "it_declarations" ADD CONSTRAINT "it_declarations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

