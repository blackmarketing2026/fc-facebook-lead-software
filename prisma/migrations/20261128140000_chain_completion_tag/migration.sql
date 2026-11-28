ALTER TABLE `EmailChain` ADD COLUMN `completionTagName` VARCHAR(80) NULL;

UPDATE `EmailChain`
SET `completionTagName` = CONCAT('Kette Ende: ', LEFT(`name`, 24), ' · ', LEFT(`id`, 36));

ALTER TABLE `EmailChain` MODIFY `completionTagName` VARCHAR(80) NOT NULL;

INSERT IGNORE INTO `Tag` (`id`, `tenantId`, `name`, `createdAt`)
SELECT UUID(), c.`tenantId`, c.`completionTagName`, CURRENT_TIMESTAMP(3)
FROM `EmailChain` c
WHERE EXISTS (SELECT 1 FROM `ChainRun` r WHERE r.`chainId` = c.`id` AND r.`status` = 'DONE');

INSERT IGNORE INTO `LeadTag` (`leadId`, `tagId`, `createdAt`)
SELECT r.`leadId`, t.`id`, CURRENT_TIMESTAMP(3)
FROM `ChainRun` r
JOIN `EmailChain` c ON c.`id` = r.`chainId`
JOIN `Tag` t ON t.`tenantId` = c.`tenantId` AND t.`name` = c.`completionTagName`
WHERE r.`status` = 'DONE';
