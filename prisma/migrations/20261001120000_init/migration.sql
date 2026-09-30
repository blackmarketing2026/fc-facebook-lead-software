-- Start-Migration für MySQL/MariaDB (z. B. All-Inkl).

-- CreateTable
CREATE TABLE `Tenant` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `isDevelopment` BOOLEAN NOT NULL DEFAULT false,
    `features` VARCHAR(1000) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Tenant_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadRoute` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `type` ENUM('RECIPIENT', 'SUBJECT', 'JSON_FIELD') NOT NULL,
    `pattern` VARCHAR(255) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadRoute_tenantId_idx`(`tenantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'SALES') NOT NULL DEFAULT 'SALES',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false,
    `distOrder` INTEGER NOT NULL DEFAULT 0,
    `distWeight` INTEGER NOT NULL DEFAULT 1,
    `distPaused` BOOLEAN NOT NULL DEFAULT false,
    `distCurrent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_tenantId_username_key`(`tenantId`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fullName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `status` ENUM('NEU', 'KONTAKTIERT', 'NICHT_ERREICHT', 'TERMIN', 'ABGESCHLOSSEN', 'VERLOREN') NOT NULL DEFAULT 'NEU',
    `rawJson` JSON NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `sourceEmailId` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Lead_sourceEmailId_key`(`sourceEmailId`),
    INDEX `Lead_tenantId_receivedAt_idx`(`tenantId`, `receivedAt`),
    INDEX `Lead_assignedToId_receivedAt_idx`(`assignedToId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadAnswer` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `questionKey` TEXT NOT NULL,
    `questionLabel` TEXT NOT NULL,
    `answers` JSON NOT NULL,

    INDEX `LeadAnswer_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `text` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Note_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reminder` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `comment` TEXT NULL,
    `done` BOOLEAN NOT NULL DEFAULT false,
    `notifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Reminder_userId_done_dueAt_idx`(`userId`, `done`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Activity` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `type` ENUM('CREATED', 'ASSIGNED', 'STATUS_CHANGED', 'CALL_CLICKED', 'WHATSAPP_CLICKED', 'EMAIL_CLICKED', 'NOTE_ADDED', 'REMINDER_SET', 'REMINDER_DONE') NOT NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Activity_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InboundEmail` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NULL,
    `messageId` VARCHAR(500) NOT NULL,
    `from` TEXT NULL,
    `to` TEXT NULL,
    `subject` TEXT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `rawText` LONGTEXT NOT NULL,
    `status` ENUM('PROCESSED', 'FAILED', 'IGNORED') NOT NULL,
    `error` TEXT NULL,

    UNIQUE INDEX `InboundEmail_messageId_key`(`messageId`),
    INDEX `InboundEmail_tenantId_receivedAt_idx`(`tenantId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PushSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `endpoint` VARCHAR(700) NOT NULL,
    `keys` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PushSubscription_endpoint_key`(`endpoint`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Setting` (
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeadRoute` ADD CONSTRAINT `LeadRoute_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_sourceEmailId_fkey` FOREIGN KEY (`sourceEmailId`) REFERENCES `InboundEmail`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadAnswer` ADD CONSTRAINT `LeadAnswer_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reminder` ADD CONSTRAINT `Reminder_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reminder` ADD CONSTRAINT `Reminder_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InboundEmail` ADD CONSTRAINT `InboundEmail_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PushSubscription` ADD CONSTRAINT `PushSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- Plattform-Mandant, Entwicklungs-Mandant (/dev) und Master-Account (Plattform-Admin).
-- Das Startpasswort des Master-Accounts wurde einmalig mitgeteilt und sollte nach dem ersten Login geändert werden.
INSERT INTO `Tenant` (`id`, `slug`, `name`, `isDevelopment`, `updatedAt`)
VALUES ('tenant_function_concept', 'function-concept', 'Function Concept', false, CURRENT_TIMESTAMP(3)),
       ('tenant_dev', 'dev', 'Entwicklung', true, CURRENT_TIMESTAMP(3));

INSERT INTO `User` (`id`, `tenantId`, `username`, `email`, `passwordHash`, `displayName`, `role`, `active`, `isPlatformAdmin`, `distOrder`, `updatedAt`)
VALUES ('user_master_account', 'tenant_function_concept', 'account', 'account@function-concept.de', '$2b$12$nY5EBzAy//VrZRZoBd.fJui77BLrjUu4Go6oiyCB2s/pTwe5SWizC', 'Master-Account', 'ADMIN', true, true, 0, CURRENT_TIMESTAMP(3));
