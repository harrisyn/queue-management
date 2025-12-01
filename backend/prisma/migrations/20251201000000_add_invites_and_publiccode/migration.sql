-- Add publicCode to Location
ALTER TABLE "Location" ADD COLUMN "publicCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Location_publicCode_key" ON "Location"("publicCode");

-- Create Invite table
CREATE TABLE IF NOT EXISTS "Invite" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'SERVICE_STAFF',
  "organizationId" TEXT,
  "createdBy" TEXT,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invite_code_key" ON "Invite"("code");
CREATE INDEX IF NOT EXISTS "Invite_organizationId_idx" ON "Invite"("organizationId");
