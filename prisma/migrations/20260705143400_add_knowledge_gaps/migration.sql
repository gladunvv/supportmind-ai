-- CreateEnum
CREATE TYPE "KnowledgeGapStatus" AS ENUM ('open', 'ignored', 'resolved');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditLogAction" ADD VALUE 'knowledge_gap_created';
ALTER TYPE "AuditLogAction" ADD VALUE 'knowledge_gap_resolved';
ALTER TYPE "AuditLogAction" ADD VALUE 'knowledge_gap_ignored';

-- AlterEnum
ALTER TYPE "UsageEventType" ADD VALUE 'knowledge_gap_detected';

-- CreateTable
CREATE TABLE "knowledge_gaps" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "normalizedText" TEXT NOT NULL,
    "status" "KnowledgeGapStatus" NOT NULL DEFAULT 'open',
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "lastAskedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exampleSources" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_gaps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_gaps_organizationId_idx" ON "knowledge_gaps"("organizationId");

-- CreateIndex
CREATE INDEX "knowledge_gaps_status_idx" ON "knowledge_gaps"("status");

-- CreateIndex
CREATE INDEX "knowledge_gaps_lastAskedAt_idx" ON "knowledge_gaps"("lastAskedAt");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_gaps_organizationId_normalizedText_key" ON "knowledge_gaps"("organizationId", "normalizedText");

-- AddForeignKey
ALTER TABLE "knowledge_gaps" ADD CONSTRAINT "knowledge_gaps_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
