-- CreateEnum
CREATE TYPE "SupportTone" AS ENUM ('neutral', 'friendly', 'professional', 'concise');

-- CreateTable
CREATE TABLE "support_drafts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "customerMessage" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "tone" "SupportTone" NOT NULL DEFAULT 'neutral',
    "sources" JSONB,
    "riskFlags" TEXT[],
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_drafts_organizationId_idx" ON "support_drafts"("organizationId");

-- CreateIndex
CREATE INDEX "support_drafts_createdById_idx" ON "support_drafts"("createdById");

-- CreateIndex
CREATE INDEX "support_drafts_needsReview_idx" ON "support_drafts"("needsReview");

-- AddForeignKey
ALTER TABLE "support_drafts" ADD CONSTRAINT "support_drafts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_drafts" ADD CONSTRAINT "support_drafts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
