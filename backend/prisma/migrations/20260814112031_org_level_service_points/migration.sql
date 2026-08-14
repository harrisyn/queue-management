-- 1. ServicePoint: add organizationId, backfill from location, drop locationId
ALTER TABLE "ServicePoint" ADD COLUMN "organizationId" TEXT;

UPDATE "ServicePoint" sp
SET "organizationId" = loc."organizationId"
FROM "Location" loc
WHERE sp."locationId" = loc."id";

ALTER TABLE "ServicePoint" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ServicePoint" ADD CONSTRAINT "ServicePoint_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ServicePoint_organizationId_isActive_idx" ON "ServicePoint"("organizationId", "isActive");

DROP INDEX IF EXISTS "ServicePoint_locationId_isActive_idx";
ALTER TABLE "ServicePoint" DROP CONSTRAINT IF EXISTS "ServicePoint_locationId_fkey";
ALTER TABLE "ServicePoint" DROP COLUMN "locationId";

-- 2. ServicePointService: backfill NULL capacity from servicePoint.capacity, make required
UPDATE "ServicePointService" sps
SET "capacity" = sp."capacity"
FROM "ServicePoint" sp
WHERE sps."servicePointId" = sp."id" AND sps."capacity" IS NULL;

ALTER TABLE "ServicePointService" ALTER COLUMN "capacity" SET NOT NULL;

-- 3. ServicePointInstance: add servicePointServiceId, backfill, drop servicePointId + currentServiceId
ALTER TABLE "ServicePointInstance" ADD COLUMN "servicePointServiceId" TEXT;

-- Prefer the link matching currentServiceId if set, else the first (only, in practice) link for that service point.
UPDATE "ServicePointInstance" spi
SET "servicePointServiceId" = (
  SELECT sps.id FROM "ServicePointService" sps
  WHERE sps."servicePointId" = spi."servicePointId"
    AND (spi."currentServiceId" IS NULL OR sps."serviceId" = spi."currentServiceId")
  ORDER BY (sps."serviceId" = spi."currentServiceId") DESC, sps."createdAt" ASC
  LIMIT 1
);

-- Orphan instances (service point has zero links) can't be attached anywhere - delete them.
DELETE FROM "ServicePointInstance" WHERE "servicePointServiceId" IS NULL;

ALTER TABLE "ServicePointInstance" ALTER COLUMN "servicePointServiceId" SET NOT NULL;
ALTER TABLE "ServicePointInstance" ADD CONSTRAINT "ServicePointInstance_servicePointServiceId_fkey"
  FOREIGN KEY ("servicePointServiceId") REFERENCES "ServicePointService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ServicePointInstance_servicePointServiceId_instanceNumber_key" ON "ServicePointInstance"("servicePointServiceId", "instanceNumber");
CREATE INDEX "ServicePointInstance_servicePointServiceId_isActive_idx" ON "ServicePointInstance"("servicePointServiceId", "isActive");

DROP INDEX IF EXISTS "ServicePointInstance_servicePointId_isActive_idx";
DROP INDEX IF EXISTS "ServicePointInstance_servicePointId_instanceNumber_key";
ALTER TABLE "ServicePointInstance" DROP CONSTRAINT IF EXISTS "ServicePointInstance_servicePointId_fkey";
ALTER TABLE "ServicePointInstance" DROP CONSTRAINT IF EXISTS "ServicePointInstance_currentServiceId_fkey";
ALTER TABLE "ServicePointInstance" DROP COLUMN "servicePointId";
ALTER TABLE "ServicePointInstance" DROP COLUMN "currentServiceId";

-- 4. QueueEntry: drop the legacy direct servicePointId FK (servicePointInstanceId is the only path going forward)
ALTER TABLE "QueueEntry" DROP CONSTRAINT IF EXISTS "QueueEntry_servicePointId_fkey";
ALTER TABLE "QueueEntry" DROP COLUMN "servicePointId";
