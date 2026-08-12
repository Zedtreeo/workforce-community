-- AlterTable: client primary-contact name
ALTER TABLE "clients" ADD COLUMN "first_name" TEXT;
ALTER TABLE "clients" ADD COLUMN "last_name" TEXT;

-- CreateTable: per-tenant invoice email template
CREATE TABLE "tenant_invoice_settings" (
    "tenant_id" TEXT NOT NULL,
    "email_subject" TEXT,
    "email_body" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenant_invoice_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- AddForeignKey
ALTER TABLE "tenant_invoice_settings" ADD CONSTRAINT "tenant_invoice_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
