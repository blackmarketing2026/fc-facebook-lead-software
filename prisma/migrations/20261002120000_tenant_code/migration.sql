-- Zweistellige Dashboard-ID für die Lead-Zuordnung über den Betreff
ALTER TABLE `Tenant` ADD COLUMN `code` VARCHAR(2) NULL;

-- Plattform = 00, Entwicklung = 99, alle übrigen Dashboards fortlaufend ab 01 (nach Anlagedatum)
UPDATE `Tenant` SET `code` = '00' WHERE `slug` = 'function-concept';
UPDATE `Tenant` SET `code` = '99' WHERE `slug` = 'dev';
UPDATE `Tenant` t
JOIN (
    SELECT `id`, ROW_NUMBER() OVER (ORDER BY `createdAt`, `id`) AS n FROM `Tenant` WHERE `code` IS NULL
) x ON t.`id` = x.`id`
SET t.`code` = LPAD(x.n, 2, '0');

ALTER TABLE `Tenant` MODIFY `code` VARCHAR(2) NOT NULL;
CREATE UNIQUE INDEX `Tenant_code_key` ON `Tenant`(`code`);
