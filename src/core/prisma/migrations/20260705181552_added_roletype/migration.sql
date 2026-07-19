/*
  Warnings:

  - Added the required column `role` to the `Memberships` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- AlterTable
ALTER TABLE "Memberships" ADD COLUMN     "role" TEXT NOT NULL;
