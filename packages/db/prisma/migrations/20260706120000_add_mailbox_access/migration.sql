-- CreateTable
CREATE TABLE "mailbox_access" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_email" TEXT NOT NULL,
    "mailbox_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mailbox_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mailbox_access_tenant_id_user_email_idx" ON "mailbox_access"("tenant_id", "user_email");

-- CreateIndex
CREATE UNIQUE INDEX "mailbox_access_tenant_id_user_email_mailbox_address_key" ON "mailbox_access"("tenant_id", "user_email", "mailbox_address");

-- AddForeignKey
ALTER TABLE "mailbox_access" ADD CONSTRAINT "mailbox_access_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
