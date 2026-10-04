-- Termin-Arten (Rückruf, WhatsApp, Termin, Vertrag …) mit Dauer und persönlicher Kalender-Abo-Link
ALTER TABLE `Reminder`
    ADD COLUMN `type` ENUM('RUECKRUF', 'ANRUF', 'WHATSAPP', 'EMAIL', 'TERMIN', 'VERTRAG', 'RUECKMELDUNG', 'SONSTIGES') NOT NULL DEFAULT 'RUECKRUF',
    ADD COLUMN `durationMinutes` INTEGER NOT NULL DEFAULT 15;

ALTER TABLE `User` ADD COLUMN `calendarToken` VARCHAR(64) NULL;
CREATE UNIQUE INDEX `User_calendarToken_key` ON `User`(`calendarToken`);
