-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "servicePointInstanceId" TEXT;

-- AlterTable
ALTER TABLE "ServicePointInstance" ADD COLUMN     "displayName" TEXT;

-- CreateIndex
CREATE INDEX "QueueEntry_servicePointInstanceId_idx" ON "QueueEntry"("servicePointInstanceId");

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_servicePointInstanceId_fkey" FOREIGN KEY ("servicePointInstanceId") REFERENCES "ServicePointInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
