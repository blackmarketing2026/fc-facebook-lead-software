-- Mitglieder können entfernt werden: Notizen bleiben ohne Autor erhalten, persönliche Termine werden mitgelöscht.
ALTER TABLE `Note` DROP FOREIGN KEY `Note_authorId_fkey`;
ALTER TABLE `Note` MODIFY `authorId` VARCHAR(191) NULL;
ALTER TABLE `Note` ADD CONSTRAINT `Note_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Reminder` DROP FOREIGN KEY `Reminder_userId_fkey`;
ALTER TABLE `Reminder` ADD CONSTRAINT `Reminder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
