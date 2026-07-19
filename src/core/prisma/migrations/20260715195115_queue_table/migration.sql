-- CreateTable
CREATE TABLE "ExportJobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fileIds" TEXT[],
    "status" TEXT DEFAULT 'pending',
    "zipS3Key" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJobs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ExportJobs" ADD CONSTRAINT "ExportJobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
