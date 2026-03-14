// 일회성 스크립트: 기존 배치명을 [대대명] 형식으로 업데이트
// 실행: npx dotenv -e .env.local -- npx tsx scripts/update-batch-names.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const batches = await prisma.batch.findMany();
  const units = await prisma.unit.findMany();
  const unitMap = new Map(units.map((u) => [u.id, u.name]));

  for (const batch of batches) {
    const unitFullName = batch.unitId ? unitMap.get(batch.unitId) || "" : "";
    const match = unitFullName.match(/(\S*대대)/);
    const shortName = match ? match[1] : unitFullName;
    const yy = String(batch.year).slice(2);
    const newName = shortName
      ? `[${shortName}] ${yy}년 ${batch.number}차 상비예비군 소집훈련`
      : `${yy}년 ${batch.number}차 상비예비군 소집훈련`;

    if (batch.name !== newName) {
      console.log(`${batch.name} → ${newName}`);
      await prisma.batch.update({
        where: { id: batch.id },
        data: { name: newName },
      });
    }
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
