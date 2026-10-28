ALTER TABLE `Tenant` ADD COLUMN `distributionPaused` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `User` ADD COLUMN `absenceReason` VARCHAR(20) NULL,
  ADD COLUMN `substituteId` VARCHAR(191) NULL,
  ADD COLUMN `isTenantMaster` BOOLEAN NOT NULL DEFAULT false;

-- Bestehenden Martin Engel in seiner Plattform als lokalen Master übernehmen.
UPDATE `User` u JOIN `Tenant` t ON t.id = u.tenantId
SET u.role = 'ADMIN', u.isTenantMaster = true
WHERE (t.slug = 'engel' OR t.name = 'Engel')
  AND (u.displayName = 'Martin Engel' OR u.username = 'martin')
  AND u.isPlatformAdmin = false;
