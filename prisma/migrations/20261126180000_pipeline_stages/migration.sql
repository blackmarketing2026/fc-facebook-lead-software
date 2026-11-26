-- Frei definierbare Pipeline-Phasen (Kanban-Ansicht) für die Leads.
CREATE TABLE `PipelineStage` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `position` INTEGER NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PipelineStage_tenantId_position_idx`(`tenantId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PipelineStage` ADD CONSTRAINT `PipelineStage_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Lead` ADD COLUMN `stageId` VARCHAR(191) NULL;
CREATE INDEX `Lead_stageId_idx` ON `Lead`(`stageId`);
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_stageId_fkey` FOREIGN KEY (`stageId`) REFERENCES `PipelineStage`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Start-Phasen für Function Concept
INSERT INTO `PipelineStage` (`id`, `tenantId`, `name`, `position`, `isDefault`)
SELECT 'stage_neukunde', t.`id`, 'Neukunde', 1, true FROM `Tenant` t WHERE t.`slug` = 'function-concept';
INSERT INTO `PipelineStage` (`id`, `tenantId`, `name`, `position`, `isDefault`)
SELECT 'stage_erstkontakt', t.`id`, 'Erstkontakt', 2, false FROM `Tenant` t WHERE t.`slug` = 'function-concept';
INSERT INTO `PipelineStage` (`id`, `tenantId`, `name`, `position`, `isDefault`)
SELECT 'stage_angebot', t.`id`, 'Google Ads Angebot erhalten', 3, false FROM `Tenant` t WHERE t.`slug` = 'function-concept';
INSERT INTO `PipelineStage` (`id`, `tenantId`, `name`, `position`, `isDefault`)
SELECT 'stage_gekauft', t.`id`, 'Google Ads Paket gekauft', 4, false FROM `Tenant` t WHERE t.`slug` = 'function-concept';

-- Bestehende Leads anhand des bisherigen Status einsortieren
UPDATE `Lead` SET `stageId` = CASE `status`
    WHEN 'KONTAKTIERT' THEN 'stage_erstkontakt'
    WHEN 'NICHT_ERREICHT' THEN 'stage_erstkontakt'
    WHEN 'TERMIN' THEN 'stage_erstkontakt'
    WHEN 'ANGEBOT_VERSENDET' THEN 'stage_angebot'
    WHEN 'ABGESCHLOSSEN' THEN 'stage_gekauft'
    ELSE 'stage_neukunde' END
WHERE `tenantId` IN (SELECT `id` FROM `Tenant` WHERE `slug` = 'function-concept');
