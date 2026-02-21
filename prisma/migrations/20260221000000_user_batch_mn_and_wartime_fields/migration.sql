-- CreateTable: BatchUser (M:N 조인 테이블)
CREATE TABLE "BatchUser" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BatchUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BatchUser_userId_batchId_key" ON "BatchUser"("userId", "batchId");

-- AddForeignKey
ALTER TABLE "BatchUser" ADD CONSTRAINT "BatchUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BatchUser" ADD CONSTRAINT "BatchUser_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: 기존 User.batchId 데이터를 BatchUser로 복사
INSERT INTO "BatchUser" ("id", "userId", "batchId", "createdAt")
SELECT gen_random_uuid()::text, "id", "batchId", NOW()
FROM "User"
WHERE "batchId" IS NOT NULL;

-- DropForeignKey: User.batchId 외래키 제거
ALTER TABLE "User" DROP CONSTRAINT "User_batchId_fkey";

-- AlterTable: User에서 batchId 제거, 새 필드 추가
ALTER TABLE "User" DROP COLUMN "batchId",
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "warBattalion" TEXT,
ADD COLUMN     "warCompany" TEXT,
ADD COLUMN     "warPlatoon" TEXT,
ADD COLUMN     "warPosition" TEXT;
