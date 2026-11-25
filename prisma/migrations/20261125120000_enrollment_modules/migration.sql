-- Per-module course access: an enrollment either opens all modules (default, keeps current access)
-- or only the modules listed in EnrollmentModule.
-- AlterTable
ALTER TABLE `Enrollment` ADD COLUMN `allModules` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `EnrollmentModule` (
    `enrollmentId` VARCHAR(191) NOT NULL,
    `moduleId` VARCHAR(191) NOT NULL,

    INDEX `EnrollmentModule_moduleId_idx`(`moduleId`),
    PRIMARY KEY (`enrollmentId`, `moduleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `EnrollmentModule` ADD CONSTRAINT `EnrollmentModule_enrollmentId_fkey` FOREIGN KEY (`enrollmentId`) REFERENCES `Enrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EnrollmentModule` ADD CONSTRAINT `EnrollmentModule_moduleId_fkey` FOREIGN KEY (`moduleId`) REFERENCES `Module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
