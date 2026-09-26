-- AlterTable
ALTER TABLE "Location" ADD COLUMN "displayConfig" JSONB;

-- CreateTable
CREATE TABLE "DisplayMedia" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileId" TEXT,
    "title" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 12,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisplayMedia_organizationId_locationId_sortOrder_idx" ON "DisplayMedia"("organizationId", "locationId", "sortOrder");

-- AddForeignKey
ALTER TABLE "DisplayMedia" ADD CONSTRAINT "DisplayMedia_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayMedia" ADD CONSTRAINT "DisplayMedia_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
