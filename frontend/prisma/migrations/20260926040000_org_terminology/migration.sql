-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "industry" TEXT,
ADD COLUMN "customerLabel" TEXT,
ADD COLUMN "customerLabelPlural" TEXT;

-- Everyone signed up so far is a clinic or hospital.
UPDATE "Organization" SET "industry" = 'HEALTHCARE' WHERE "industry" IS NULL;
