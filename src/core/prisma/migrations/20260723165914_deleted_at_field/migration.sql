-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'CREATE';

-- AlterTable
ALTER TABLE "Files" ADD COLUMN     "deletedAt" TIMESTAMP(3);
