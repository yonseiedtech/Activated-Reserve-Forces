-- AlterTable
ALTER TABLE "BatchUser" ADD COLUMN     "expectedConfirmAt" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "CommutingRecord" ADD COLUMN     "batchId" TEXT;

-- AddForeignKey
ALTER TABLE "CommutingRecord" ADD CONSTRAINT "CommutingRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
