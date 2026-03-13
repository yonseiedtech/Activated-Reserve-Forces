import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET: 연간 훈련 계획 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = req.nextUrl;
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  // RESERVIST는 자기 차수만
  let batchFilter: Record<string, unknown> = {};
  if (session.user.role === "RESERVIST") {
    const myBatches = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    batchFilter = { id: { in: myBatches.map((b) => b.batchId) } };
  }

  const batches = await prisma.batch.findMany({
    where: {
      ...batchFilter,
      OR: [
        { startDate: { gte: yearStart, lt: yearEnd } },
        { endDate: { gte: yearStart, lt: yearEnd } },
        { startDate: { lt: yearStart }, endDate: { gte: yearEnd } },
      ],
    },
    orderBy: [{ startDate: "asc" }],
    include: {
      _count: { select: { batchUsers: true, trainings: true } },
      trainings: {
        where: { date: { gte: yearStart, lt: yearEnd } },
        orderBy: { date: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          startTime: true,
          endTime: true,
        },
      },
    },
  });

  // 월별 요약
  const monthlySummary: Record<number, { batchCount: number; trainingCount: number; batchNames: string[] }> = {};
  for (let m = 1; m <= 12; m++) {
    monthlySummary[m] = { batchCount: 0, trainingCount: 0, batchNames: [] };
  }

  for (const batch of batches) {
    const start = new Date(batch.startDate);
    const end = new Date(batch.endDate);

    // 이 차수가 걸치는 월 계산
    const startMonth = start.getFullYear() === year ? start.getMonth() + 1 : 1;
    const endMonth = end.getFullYear() === year ? end.getMonth() + 1 : 12;

    for (let m = Math.max(1, startMonth); m <= Math.min(12, endMonth); m++) {
      monthlySummary[m].batchCount++;
      monthlySummary[m].batchNames.push(batch.name);
    }

    for (const t of batch.trainings) {
      const tMonth = new Date(t.date).getMonth() + 1;
      if (tMonth >= 1 && tMonth <= 12) {
        monthlySummary[tMonth].trainingCount++;
      }
    }
  }

  return json({
    year,
    batches: batches.map((b) => ({
      id: b.id,
      name: b.name,
      year: b.year,
      number: b.number,
      startDate: b.startDate,
      endDate: b.endDate,
      location: b.location,
      requiredHours: b.requiredHours,
      userCount: b._count.batchUsers,
      trainingCount: b._count.trainings,
      trainings: b.trainings,
    })),
    monthlySummary,
  });
}
