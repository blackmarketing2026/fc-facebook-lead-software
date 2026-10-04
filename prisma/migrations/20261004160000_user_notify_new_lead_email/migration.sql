-- Mitglied bekommt eine E-Mail, wenn ihm ein neuer Lead zugewiesen wird
ALTER TABLE `User` ADD COLUMN `notifyNewLeadEmail` BOOLEAN NOT NULL DEFAULT false;
