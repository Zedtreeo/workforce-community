-- Billing entities: one legal company per invoice (name, address, payment
-- instructions, own invoice-number series).
CREATE TABLE "billing_entities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registered_address" TEXT,
    "tax_line" TEXT,
    "payment_instructions" TEXT,
    "invoice_prefix" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "billing_entities_tenant_id_name_key" ON "billing_entities"("tenant_id", "name");
CREATE INDEX "billing_entities_tenant_id_idx" ON "billing_entities"("tenant_id");

ALTER TABLE "invoices" ADD COLUMN "billing_entity_id" TEXT;
CREATE INDEX "invoices_billing_entity_id_idx" ON "invoices"("billing_entity_id");
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_entity_id_fkey"
    FOREIGN KEY ("billing_entity_id") REFERENCES "billing_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the primary entity for every existing tenant from its current name +
-- the LEGELP/ZT series, marked default, and back-fill existing invoices to it.
INSERT INTO "billing_entities" ("id", "tenant_id", "name", "invoice_prefix", "is_default", "is_active", "updated_at")
SELECT 'be_' || substr(md5(t.id || 'primary'), 1, 21), t.id, t.name, 'LEGELP/ZT', true, true, CURRENT_TIMESTAMP
FROM "tenants" t
ON CONFLICT ("tenant_id", "name") DO NOTHING;

UPDATE "invoices" i
SET "billing_entity_id" = be.id
FROM "billing_entities" be
WHERE be."tenant_id" = i."tenant_id"
  AND be."is_default" = true
  AND i."billing_entity_id" IS NULL;
