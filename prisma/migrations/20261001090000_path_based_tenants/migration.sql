-- Mandanten laufen über den Pfad (/<slug>) statt über eigene Domains: Domain- und Einmal-Link-Tabellen entfallen.

-- DropForeignKey
ALTER TABLE "TenantDomain" DROP CONSTRAINT "TenantDomain_tenantId_fkey";

-- DropTable
DROP TABLE "TenantDomain";

-- DropTable
DROP TABLE "HandoffToken";


-- Master-Account (Plattform-Admin): sieht im Plattform-Bereich alle Mandanten inkl. Entwicklung.
-- Startpasswort wurde einmalig mitgeteilt und sollte nach dem ersten Login geändert werden.
INSERT INTO "User" ("id", "tenantId", "username", "email", "passwordHash", "displayName", "role", "active", "isPlatformAdmin", "distOrder", "createdAt", "updatedAt")
VALUES ('user_master_account', 'tenant_function_concept', 'account', 'account@function-concept.de', '$2b$12$nY5EBzAy//VrZRZoBd.fJui77BLrjUu4Go6oiyCB2s/pTwe5SWizC', 'Master-Account', 'ADMIN', true, true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "username") DO UPDATE SET "isPlatformAdmin" = true, "role" = 'ADMIN', "active" = true;

-- Entwicklungs-Mandant (unter /dev), falls noch nicht vorhanden
INSERT INTO "Tenant" ("id", "slug", "name", "isDevelopment", "updatedAt")
VALUES ('tenant_dev', 'dev', 'Entwicklung', true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
