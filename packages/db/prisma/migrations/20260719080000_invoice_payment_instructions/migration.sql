-- Editable payment-instructions block for invoice PDFs.
ALTER TABLE "tenant_invoice_settings" ADD COLUMN "payment_instructions" TEXT;
