import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { calcCompensation } from "@/lib/compensation";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const batches = await prisma.batch.findMany({
    orderBy: { startDate: "desc" },
    include: {
      paymentProcesses: true,
      trainings: {
        include: {
          compensation: true,
          attendances: { select: { status: true } },
        },
      },
      transportAllowances: true,
      batchUsers: true,
    },
  });

  const rows = batches.map((batch) => {
    const process = batch.paymentProcesses[0] || null;
    const totalUsers = batch.batchUsers.length;

    // 참석 현황: 전체 훈련 중 PRESENT 수
    const presentCount = batch.trainings.reduce((sum, t) => {
      return sum + t.attendances.filter((a) => a.status === "PRESENT").length;
    }, 0);
    const totalAttendance = batch.trainings.reduce((sum, t) => sum + t.attendances.length, 0);

    // 보상비 합계
    const compensationTotal = batch.trainings.reduce((sum, t) => {
      const calc = calcCompensation(t);
      const finalRate = t.compensation?.overrideRate ?? t.compensation?.dailyRate ?? calc.dailyRate;
      return sum + finalRate;
    }, 0);

    // 교통비 합계
    const transportTotal = batch.transportAllowances.reduce((sum, ta) => sum + ta.amount, 0);

    return {
      batchId: batch.id,
      batchName: batch.name,
      status: process?.status || "DOC_DRAFT",
      presentCount,
      totalAttendance,
      totalUsers,
      compensationTotal,
      transportTotal,
      grandTotal: compensationTotal + transportTotal,
    };
  });

  // 하단 요약
  const pendingTotal = rows
    .filter((r) => r.status !== "CMS_APPROVED")
    .reduce((sum, r) => sum + r.grandTotal, 0);
  const paidTotal = rows
    .filter((r) => r.status === "CMS_APPROVED")
    .reduce((sum, r) => sum + r.grandTotal, 0);
  const allTotal = rows.reduce((sum, r) => sum + r.grandTotal, 0);

  return json({
    rows,
    summary: { pendingTotal, paidTotal, allTotal },
  });
}
