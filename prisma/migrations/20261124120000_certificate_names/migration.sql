-- Names printed on generated PDF certificates
-- AlterTable
ALTER TABLE `Certificate`
    ADD COLUMN `nameRu` VARCHAR(160) NULL,
    ADD COLUMN `nameLat` VARCHAR(160) NULL;
