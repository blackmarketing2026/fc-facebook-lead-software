-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `emailOptOutAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Activity` MODIFY `type` ENUM('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'CALL_CLICKED', 'WHATSAPP_CLICKED', 'EMAIL_CLICKED', 'NOTE_ADDED', 'REMINDER_SET', 'REMINDER_DONE', 'TAG_ADDED', 'TAG_REMOVED', 'EMAIL_SENT', 'UNSUBSCRIBED', 'RESUBSCRIBED') NOT NULL;


-- Bereits abgemeldete Leads: Abmeldezeitpunkt nachtragen (genaues Datum unbekannt)
UPDATE `Lead` SET `emailOptOutAt` = `updatedAt` WHERE `emailOptOut` = true AND `emailOptOutAt` IS NULL;
