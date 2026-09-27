-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "allowAnonymous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Service" ADD COLUMN     "requiresName" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Service" ADD COLUMN     "requiresPhone" BOOLEAN NOT NULL DEFAULT false;
