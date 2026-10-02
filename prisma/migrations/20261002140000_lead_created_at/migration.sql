-- Zeitpunkt des Anlegens eines Leads (für die Live-Benachrichtigung im Dashboard)
ALTER TABLE `Lead` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
UPDATE `Lead` SET `createdAt` = `receivedAt`;
CREATE INDEX `Lead_tenantId_createdAt_idx` ON `Lead`(`tenantId`, `createdAt`);
