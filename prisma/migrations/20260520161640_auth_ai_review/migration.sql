/*
  Warnings:

  - You are about to drop the column `authorId` on the `Article` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `Article` DROP FOREIGN KEY `Article_authorId_fkey`;

-- DropIndex
DROP INDEX `Article_authorId_idx` ON `Article`;

-- AlterTable
ALTER TABLE `AdminUser` MODIFY `role` ENUM('ADMIN', 'PERSONAL') NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE `Article` DROP COLUMN `authorId`,
    ADD COLUMN `adminAuthorId` VARCHAR(191) NULL,
    ADD COLUMN `personalAuthorId` VARCHAR(191) NULL,
    MODIFY `status` ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE `PersonalUser` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(100) NULL,
    `phone` VARCHAR(30) NULL,
    `passwordHash` VARCHAR(255) NULL,
    `role` ENUM('ADMIN', 'PERSONAL') NOT NULL DEFAULT 'PERSONAL',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PersonalUser_email_key`(`email`),
    UNIQUE INDEX `PersonalUser_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ArticleReview` (
    `id` VARCHAR(191) NOT NULL,
    `articleId` VARCHAR(191) NOT NULL,
    `reviewType` ENUM('AI', 'HUMAN') NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED', 'MANUAL_REQUIRED') NOT NULL,
    `reason` TEXT NULL,
    `riskTags` JSON NULL,
    `reviewedByUserId` VARCHAR(191) NULL,
    `modelName` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ArticleReview_articleId_createdAt_idx`(`articleId`, `createdAt`),
    INDEX `ArticleReview_decision_createdAt_idx`(`decision`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhoneOtpCode` (
    `id` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `codeHash` VARCHAR(255) NOT NULL,
    `purpose` ENUM('LOGIN', 'REGISTER') NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhoneOtpCode_phone_purpose_createdAt_idx`(`phone`, `purpose`, `createdAt`),
    INDEX `PhoneOtpCode_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Article_adminAuthorId_idx` ON `Article`(`adminAuthorId`);

-- CreateIndex
CREATE INDEX `Article_personalAuthorId_idx` ON `Article`(`personalAuthorId`);

-- CreateIndex
CREATE INDEX `Article_status_updatedAt_idx` ON `Article`(`status`, `updatedAt`);

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_adminAuthorId_fkey` FOREIGN KEY (`adminAuthorId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Article` ADD CONSTRAINT `Article_personalAuthorId_fkey` FOREIGN KEY (`personalAuthorId`) REFERENCES `PersonalUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleReview` ADD CONSTRAINT `ArticleReview_articleId_fkey` FOREIGN KEY (`articleId`) REFERENCES `Article`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ArticleReview` ADD CONSTRAINT `ArticleReview_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `PersonalUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
