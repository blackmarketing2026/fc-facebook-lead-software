ALTER TABLE `User` ADD COLUMN `salesEnabled` BOOLEAN NOT NULL DEFAULT false;

-- Martin Engel soll als bestehender Plattform-Master auch Leads erhalten können.
UPDATE `User` u JOIN `Tenant` t ON t.id = u.tenantId
SET u.salesEnabled = true
WHERE (t.slug = 'engel' OR t.name = 'Engel')
  AND (u.email = 'martin.engel@arag-partner.de' OR u.displayName = 'Martin Engel' OR u.username = 'martin')
  AND u.role = 'ADMIN';
