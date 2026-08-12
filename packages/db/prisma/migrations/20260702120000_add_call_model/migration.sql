-- CreateEnum
CREATE TYPE "CallMedia" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'MISSED', 'ENDED');

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "caller_id" TEXT NOT NULL,
    "callee_id" TEXT NOT NULL,
    "media" "CallMedia" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calls_tenant_id_idx" ON "calls"("tenant_id");

-- CreateIndex
CREATE INDEX "calls_tenant_id_caller_id_idx" ON "calls"("tenant_id", "caller_id");

-- CreateIndex
CREATE INDEX "calls_tenant_id_callee_id_idx" ON "calls"("tenant_id", "callee_id");

-- CreateIndex
CREATE INDEX "calls_tenant_id_created_at_idx" ON "calls"("tenant_id", "created_at");

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
