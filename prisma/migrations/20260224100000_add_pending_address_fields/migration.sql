-- AlterTable
ALTER TABLE "User" ADD COLUMN "pendingZipCode" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingAddress" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingAddressDetail" TEXT;
ALTER TABLE "User" ADD COLUMN "addressRejectedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "addressRejectReason" TEXT;
