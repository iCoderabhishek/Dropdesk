/*
  Warnings:

  - The `status` column on the `ExportJobs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `Files` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `Memberships` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `oAuthProvider` column on the `Users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "OauthProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('FILE', 'WORKSPACE', 'MEMBER', 'EXPORT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'SCANNING', 'READY', 'QUARANTINED', 'MALWARE', 'PROCESSING', 'FAILED');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('UPLOAD', 'DELETE', 'SHARE', 'UPDATE');

-- AlterTable
ALTER TABLE "ExportJobs" DROP COLUMN "status",
ADD COLUMN     "status" "ExportStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Files" DROP COLUMN "status",
ADD COLUMN     "status" "FileStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Memberships" DROP COLUMN "role",
ADD COLUMN     "role" "RoleType" NOT NULL DEFAULT 'VIEWER';

-- AlterTable
ALTER TABLE "Users" DROP COLUMN "oAuthProvider",
ADD COLUMN     "oAuthProvider" "OauthProvider" NOT NULL DEFAULT 'GOOGLE';

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT,
    "metaData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_oAuthProvider_oAuthId_key" ON "Users"("oAuthProvider", "oAuthId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
