/*
  Warnings:

  - The values [pi_key_request] on the enum `UsageEventType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UsageEventType_new" AS ENUM ('document_uploaded', 'document_indexed', 'embedding_generated', 'ai_question_asked', 'support_reply_generated', 'api_key_request');
ALTER TABLE "usage_events" ALTER COLUMN "type" TYPE "UsageEventType_new" USING ("type"::text::"UsageEventType_new");
ALTER TYPE "UsageEventType" RENAME TO "UsageEventType_old";
ALTER TYPE "UsageEventType_new" RENAME TO "UsageEventType";
DROP TYPE "public"."UsageEventType_old";
COMMIT;
