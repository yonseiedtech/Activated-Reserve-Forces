import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized } from "@/lib/api-utils";
import { calcCompensation } from "@/lib/compensation";

// 예비역: 내 차수별 훈련비 리스트
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const batchUsers = await prisma.batchUser.findMany({
    where: { userId: session.user.id },
    include: {
      batch: {
        include: {
          trainings: {
            include: { compensation: true },
          },
          transportAllowances: {
            where: { userId: session.user.id },
          },
          paymentProcesses: true,
        },
      },
    },
    orderBy: { batch: { startDate: "asc" } },
  });

  const result = batchUsers.map((bu) => {
    const batch = bu.batch;
    const process = batch.paymentProcesses[0];

    const compensationTotal = batch.trainings.reduce((sum, t) => {
      if (!t.countsTowardHours) return sum;
      const calc = calcCompensation(t);
      const finalRate = t.compensation?.overrideRate ?? t.compensation?.dailyRate ?? calc.dailyRate;
      return sum + finalRate;
    }, 0);

    const transportAmount = batch.transportAllowances[0]?.amount || 0;

    return {
      batchId: batch.id,
      batchName: batch.name,
      startDate: batch.startDate,
      endDate: batch.endDate,
      status: process?.status || "DOC_DRAFT",
      compensationTotal,
      transportAmount,
      grandTotal: compensationTotal + transportAmount,
    };
  });

  return json(result);
}
