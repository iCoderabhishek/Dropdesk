-- CreateIndex
CREATE INDEX "Files_workspaceId_deletedAt_idx" ON "Files"("workspaceId", "deletedAt");
