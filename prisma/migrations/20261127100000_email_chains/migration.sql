-- AlterTable
ALTER TABLE `Lead` ADD COLUMN `emailOptOut` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `Tag` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Tag_tenantId_name_key`(`tenantId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LeadTag` (
    `leadId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LeadTag_tagId_idx`(`tagId`),
    PRIMARY KEY (`leadId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailChain` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `triggerTagId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailChain_tenantId_idx`(`tenantId`),
    INDEX `EmailChain_triggerTagId_idx`(`triggerTagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailChainStep` (
    `id` VARCHAR(191) NOT NULL,
    `chainId` VARCHAR(191) NOT NULL,
    `position` INTEGER NOT NULL,
    `type` ENUM('EMAIL', 'WAIT') NOT NULL,
    `subject` VARCHAR(300) NULL,
    `body` TEXT NULL,
    `waitValue` INTEGER NULL,
    `waitUnit` ENUM('MINUTES', 'HOURS', 'DAYS') NULL,

    INDEX `EmailChainStep_chainId_position_idx`(`chainId`, `position`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChainRun` (
    `id` VARCHAR(191) NOT NULL,
    `chainId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'DONE', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `nextRunAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,

    INDEX `ChainRun_status_nextRunAt_idx`(`status`, `nextRunAt`),
    UNIQUE INDEX `ChainRun_chainId_leadId_key`(`chainId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChainSend` (
    `id` VARCHAR(191) NOT NULL,
    `runId` VARCHAR(191) NOT NULL,
    `chainId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(300) NOT NULL,
    `status` ENUM('SENT', 'FAILED', 'SKIPPED') NOT NULL,
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChainSend_chainId_sentAt_idx`(`chainId`, `sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Tag` ADD CONSTRAINT `Tag_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeadTag` ADD CONSTRAINT `LeadTag_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `Tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailChain` ADD CONSTRAINT `EmailChain_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailChain` ADD CONSTRAINT `EmailChain_triggerTagId_fkey` FOREIGN KEY (`triggerTagId`) REFERENCES `Tag`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailChainStep` ADD CONSTRAINT `EmailChainStep_chainId_fkey` FOREIGN KEY (`chainId`) REFERENCES `EmailChain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChainRun` ADD CONSTRAINT `ChainRun_chainId_fkey` FOREIGN KEY (`chainId`) REFERENCES `EmailChain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChainRun` ADD CONSTRAINT `ChainRun_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChainSend` ADD CONSTRAINT `ChainSend_runId_fkey` FOREIGN KEY (`runId`) REFERENCES `ChainRun`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChainSend` ADD CONSTRAINT `ChainSend_chainId_fkey` FOREIGN KEY (`chainId`) REFERENCES `EmailChain`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

