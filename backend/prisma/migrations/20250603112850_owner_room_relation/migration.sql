/*
  Warnings:

  - Made the column `ownerName` on table `Room` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Room" ALTER COLUMN "ownerName" SET NOT NULL,
ALTER COLUMN "ownerName" DROP DEFAULT;
