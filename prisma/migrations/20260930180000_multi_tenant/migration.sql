-- Mandantenfähigkeit: Alle bestehenden Daten wandern in den Mandanten "Function Concept".

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LeadRouteType" AS ENUM ('RECIPIENT', 'SUBJECT', 'JSON_FIELD');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDevelopment" BOOLEAN NOT NULL DEFAULT false,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDomain" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadRoute" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "LeadRouteType" NOT NULL,
    "pattern" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoffToken_pkey" PRIMARY KEY ("id")
);

-- Standard-Mandant für alle bisherigen Daten
INSERT INTO "Tenant" ("id", "slug", "name", "updatedAt")
VALUES ('tenant_function_concept', 'function-concept', 'Function Concept', CURRENT_TIMESTAMP);

-- Bestehende Zeilen zuordnen, danach wird die Spalte Pflicht (ohne Default)
ALTER TABLE "User" ADD COLUMN "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_function_concept';
ALTER TABLE "User" ALTER COLUMN "tenantId" DROP DEFAULT;

ALTER TABLE "Lead" ADD COLUMN "tenantId" TEXT NOT NULL DEFAULT 'tenant_function_concept';
ALTER TABLE "Lead" ALTER COLUMN "tenantId" DROP DEFAULT;

ALTER TABLE "InboundEmail" ADD COLUMN "tenantId" TEXT,
ADD COLUMN "to" TEXT;
UPDATE "InboundEmail" SET "tenantId" = 'tenant_function_concept';

-- Die bisherigen Admins werden Plattform-Admins
UPDATE "User" SET "isPlatformAdmin" = true WHERE "role" = 'ADMIN';

-- DropIndex
DROP INDEX "User_username_key";

-- DropIndex
DROP INDEX "Lead_receivedAt_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantDomain_hostname_key" ON "TenantDomain"("hostname");

-- CreateIndex
CREATE INDEX "TenantDomain_tenantId_idx" ON "TenantDomain"("tenantId");

-- CreateIndex
CREATE INDEX "LeadRoute_tenantId_idx" ON "LeadRoute"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_username_key" ON "User"("tenantId", "username");

-- CreateIndex
CREATE INDEX "Lead_tenantId_receivedAt_idx" ON "Lead"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "InboundEmail_tenantId_receivedAt_idx" ON "InboundEmail"("tenantId", "receivedAt");

-- AddForeignKey
ALTER TABLE "TenantDomain" ADD CONSTRAINT "TenantDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadRoute" ADD CONSTRAINT "LeadRoute_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
