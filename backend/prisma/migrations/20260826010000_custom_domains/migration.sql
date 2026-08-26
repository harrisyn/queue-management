-- CreateEnum
CREATE TYPE "CustomDomainStatus" AS ENUM ('PENDING', 'VERIFIED');

-- CreateTable
CREATE TABLE "CustomDomain" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" "CustomDomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_organizationId_key" ON "CustomDomain"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomDomain_domain_key" ON "CustomDomain"("domain");

-- AddForeignKey
ALTER TABLE "CustomDomain" ADD CONSTRAINT "CustomDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
