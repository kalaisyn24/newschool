-- Certificates are now uploaded by the admin as PDF files.
-- AlterTable
ALTER TABLE `Certificate`
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `fileKey` VARCHAR(300) NULL,
    ADD COLUMN `fileSize` INTEGER NULL,
    MODIFY `issuedAt` DATETIME(3) NULL;

-- Existing certificates keep their issue date as creation date
UPDATE `Certificate` SET `createdAt` = `issuedAt` WHERE `issuedAt` IS NOT NULL;

-- CreateIndex
CREATE INDEX `Certificate_issuedAt_idx` ON `Certificate`(`issuedAt`);
