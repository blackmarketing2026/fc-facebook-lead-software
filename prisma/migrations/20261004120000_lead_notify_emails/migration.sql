-- E-Mail-Adressen, die pro Dashboard bei jedem neuen Lead benachrichtigt werden
ALTER TABLE `Tenant` ADD COLUMN `leadNotifyEmails` VARCHAR(1000) NOT NULL DEFAULT '';
