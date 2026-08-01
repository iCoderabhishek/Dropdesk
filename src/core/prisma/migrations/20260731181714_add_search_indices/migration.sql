/*
  Warnings:

  - Added the required column `updatedAt` to the `Files` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Files" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

CREATE INDEX "files_name_search_idx" ON "Files" USING GIN (to_tsvector('english', "name"));
CREATE INDEX "workspaces_name_search_idx" ON "Workspaces" USING GIN (to_tsvector('english', "workspaceName"));
