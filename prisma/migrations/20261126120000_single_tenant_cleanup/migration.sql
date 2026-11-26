-- Bereinigung: Die Software wird nur noch von Function Concept selbst genutzt.
-- Alle Kunden-Dashboards (inkl. Entwicklung) werden samt Leads, Mitgliedern und Mails gelöscht.
-- Das Dashboard "function-concept" bleibt unverändert erhalten.

DELETE FROM `Lead` WHERE `tenantId` IN (SELECT `id` FROM `Tenant` WHERE `slug` <> 'function-concept');
DELETE FROM `InboundEmail` WHERE `tenantId` IN (SELECT `id` FROM `Tenant` WHERE `slug` <> 'function-concept');
DELETE FROM `User` WHERE `tenantId` IN (SELECT `id` FROM `Tenant` WHERE `slug` <> 'function-concept');
DELETE FROM `Tenant` WHERE `slug` <> 'function-concept';

-- Kundenverwaltung (Zuordnungsregeln, Plattform-Rechte, Feature-Schalter, Sperren) entfällt.
DROP TABLE `LeadRoute`;
DROP TABLE `PlatformGrant`;
DROP INDEX `Tenant_code_key` ON `Tenant`;
ALTER TABLE `Tenant` DROP COLUMN `code`, DROP COLUMN `status`, DROP COLUMN `isDevelopment`, DROP COLUMN `features`;

-- Master-Login neu: neues Passwort, Konto aktiv. Die SMTP-Einstellungen liegen in den Umgebungsvariablen und bleiben unberührt.
UPDATE `User` SET `passwordHash` = '$2b$12$NfH9Y2Bnntbrzjv6frlJ/ur49PcOWVCiTrfH6prPAg0TpwvuKL7UG', `active` = true, `isPlatformAdmin` = true, `role` = 'ADMIN' WHERE `id` = 'user_master_account';
