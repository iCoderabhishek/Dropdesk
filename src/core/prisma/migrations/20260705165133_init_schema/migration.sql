-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "oAuthProvider" TEXT NOT NULL,
    "oAuthId" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspaces" (
    "id" TEXT NOT NULL,
    "workspaceName" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memberships" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "s3Key" TEXT NOT NULL,
    "size" BIGINT,
    "mimetype" TEXT,
    "workspaceId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,

    CONSTRAINT "Files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Users_phone_key" ON "Users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Users_oAuthProvider_oAuthId_key" ON "Users"("oAuthProvider", "oAuthId");

-- CreateIndex
CREATE UNIQUE INDEX "Memberships_workspaceId_userId_key" ON "Memberships"("workspaceId", "userId");

-- AddForeignKey
ALTER TABLE "Workspaces" ADD CONSTRAINT "Workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memberships" ADD CONSTRAINT "Memberships_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memberships" ADD CONSTRAINT "Memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Files" ADD CONSTRAINT "Files_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Files" ADD CONSTRAINT "Files_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "Users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
