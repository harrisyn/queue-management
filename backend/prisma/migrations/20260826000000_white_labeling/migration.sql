-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "logoFileId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "primaryColor" TEXT;
ALTER TABLE "Organization" ADD COLUMN "hidePoweredBy" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "FileStorageProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "publicKey" TEXT,
    "secretKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileStorageProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FileStorageProviderConfig_provider_key" ON "FileStorageProviderConfig"("provider");
