-- Provision beim Abschluss
ALTER TABLE `Lead` ADD COLUMN `commission` DECIMAL(12, 2) NULL,
    ADD COLUMN `closedAt` DATETIME(3) NULL;

CREATE INDEX `Lead_tenantId_closedAt_idx` ON `Lead`(`tenantId`, `closedAt`);

-- Bisherige Abschlüsse erscheinen in der Liste (ohne Provision, bis sie nachgetragen wird).
UPDATE `Lead` SET `closedAt` = `updatedAt` WHERE `status` = 'ABGESCHLOSSEN';
