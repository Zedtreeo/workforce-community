-- Per-client default billing entity (which legal company invoices them).
ALTER TABLE "clients" ADD COLUMN "billing_entity_id" TEXT;
CREATE INDEX "clients_billing_entity_id_idx" ON "clients"("billing_entity_id");
ALTER TABLE "clients" ADD CONSTRAINT "clients_billing_entity_id_fkey"
    FOREIGN KEY ("billing_entity_id") REFERENCES "billing_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
