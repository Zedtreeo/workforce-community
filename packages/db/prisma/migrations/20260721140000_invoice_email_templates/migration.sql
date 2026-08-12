-- Named, reusable invoice email templates (plain-text body with {{variables}}).
CREATE TABLE "invoice_email_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_email_templates_tenant_id_name_key" ON "invoice_email_templates"("tenant_id", "name");
CREATE INDEX "invoice_email_templates_tenant_id_idx" ON "invoice_email_templates"("tenant_id");

-- Seed one plain-text "Default" template per tenant.
INSERT INTO "invoice_email_templates" ("id", "tenant_id", "name", "subject", "body", "is_default", "updated_at")
SELECT
  'iet_' || substr(md5(t.id || 'default'), 1, 20),
  t.id,
  'Default',
  'Invoice {{invoiceNumber}} — {{clientName}}',
  E'Dear {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for the period {{period}}.\n\nTotal due: {{currency}} {{total}}\nPayment terms: {{paymentTerms}}\nDue date: {{dueDate}}\n\nPlease reply to this email if you have any questions.\n\nBest regards,\nAccounts Team',
  true,
  CURRENT_TIMESTAMP
FROM "tenants" t
ON CONFLICT ("tenant_id", "name") DO NOTHING;
