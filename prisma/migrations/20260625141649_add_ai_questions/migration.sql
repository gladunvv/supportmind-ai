-- CreateEnum
CREATE TYPE "AiQuestionStatus" AS ENUM ('answered', 'needs_review', 'failed');

-- CreateTable
CREATE TABLE "ai_questions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "askedById" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "AiQuestionStatus" NOT NULL DEFAULT 'answered',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "sources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_questions_organizationId_idx" ON "ai_questions"("organizationId");

-- CreateIndex
CREATE INDEX "ai_questions_askedById_idx" ON "ai_questions"("askedById");

-- CreateIndex
CREATE INDEX "ai_questions_status_idx" ON "ai_questions"("status");

-- AddForeignKey
ALTER TABLE "ai_questions" ADD CONSTRAINT "ai_questions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_questions" ADD CONSTRAINT "ai_questions_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
