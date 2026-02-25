import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { calcCompensation } from "@/lib/compensation";

// 차수의 모든 훈련에 대해 보상비 자동 계산 → DB 동기화
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { batchId } = body as { batchId: string };
  if (!batchId) return badRequest("batchId가 필요합니다.");

  const trainings = await prisma.training.findMany({
    where: { batchId },
    include: { compensation: true },
  });

  const results = await Promise.all(
    trainings.map((t) => {
      const calc = calcCompensation(t);
      // countsTowardHours가 false인 훈련(식사 등)은 이수시간·보상비 0으로 처리
      const hours = t.countsTowardHours ? calc.trainingHours : 0;
      const rate = t.countsTowardHours ? calc.dailyRate : 0;
      return prisma.trainingCompensation.upsert({
        where: { trainingId: t.id },
        create: {
          trainingId: t.id,
          trainingHours: hours,
          isWeekend: calc.isWeekend,
          dailyRate: rate,
        },
        update: {
          trainingHours: hours,
          isWeekend: calc.isWeekend,
          dailyRate: rate,
          // overrideRate는 유지 (관리자가 수동 설정한 값)
        },
      });
    })
  );

  return json({ synced: results.length });
}
