-- "Удостоверение профайлера": requested on course completion, issued when the admin uploads a PDF.
-- AlterTable
ALTER TABLE `Course` ADD COLUMN `profilerCardEnabled` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `ProfilerCard` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `courseId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issuedAt` DATETIME(3) NULL,
    `fileKey` VARCHAR(300) NULL,
    `fileSize` INTEGER NULL,

    INDEX `ProfilerCard_issuedAt_idx`(`issuedAt`),
    UNIQUE INDEX `ProfilerCard_userId_courseId_key`(`userId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProfilerCard` ADD CONSTRAINT `ProfilerCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProfilerCard` ADD CONSTRAINT `ProfilerCard_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- The existing profiling course issues profiler ID cards
UPDATE `Course` SET `profilerCardEnabled` = true;
