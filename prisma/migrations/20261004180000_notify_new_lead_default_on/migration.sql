-- Vertriebler bekommen die Mail bei neu zugewiesenen Leads standardmäßig (pro Person abschaltbar)
ALTER TABLE `User` ALTER COLUMN `notifyNewLeadEmail` SET DEFAULT true;
UPDATE `User` SET `notifyNewLeadEmail` = true WHERE `role` = 'SALES';
