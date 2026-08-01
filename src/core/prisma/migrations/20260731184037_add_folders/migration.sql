-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'MOVE';

-- AlterEnum
ALTER TYPE "AuditTargetType" ADD VALUE 'FOLDER';

-- AlterTable
ALTER TABLE "Files" ADD COLUMN     "folderId" TEXT,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folders_workspaceId_parentId_deletedAt_idx" ON "Folders"("workspaceId", "parentId", "deletedAt");

-- CreateIndex
CREATE INDEX "Files_folderId_idx" ON "Files"("folderId");

-- AddForeignKey
ALTER TABLE "Files" ADD CONSTRAINT "Files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folders" ADD CONSTRAINT "Folders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folders" ADD CONSTRAINT "Folders_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
