-- Optional file attached to a practical assignment submission
-- AlterTable
ALTER TABLE `AssignmentSubmission`
    ADD COLUMN `fileKey` VARCHAR(300) NULL,
    ADD COLUMN `fileName` VARCHAR(255) NULL,
    ADD COLUMN `fileSize` INTEGER NULL;
