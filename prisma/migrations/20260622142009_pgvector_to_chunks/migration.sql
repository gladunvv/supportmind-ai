/*
  Warnings:

  - You are about to drop the column `embedding` on the `document_chunks` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "document_chunks" DROP COLUMN "embedding";
