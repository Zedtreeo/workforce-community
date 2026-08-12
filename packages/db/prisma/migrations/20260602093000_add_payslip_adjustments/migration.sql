-- AddColumn: ad-hoc per-payslip head adjustments (earning/deduction line items)
ALTER TABLE "payslips" ADD COLUMN "adjustments" JSONB NOT NULL DEFAULT '[]';
