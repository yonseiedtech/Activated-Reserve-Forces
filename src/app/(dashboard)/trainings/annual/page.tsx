import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";
import AnnualClient from "./AnnualClient";

function computeBatchStatus(startDate: Date, endDate: Date): "PLANNED" | "ACTIVE" | "COMPLETED" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (today < start) return "PLANNED";
  if (today > end) return "COMPLETED";
  return "ACTIVE";
}

export default async function AnnualTrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const resolvedParams = await searchParams;
  const now = new Date();
  const year = parseInt(resolvedParams.year || String(now.getFullYear()));
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

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
      _count: { select: { batchUsers: true } },
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

  // 차수별 해당 월 계산 + 상태 산출
  const batchData = batches.map((batch) => {
    const start = new Date(batch.startDate);
    const end = new Date(batch.endDate);
    const sm = start.getFullYear() === year ? start.getMonth() : 0;
    const em = end.getFullYear() === year ? end.getMonth() : 11;
    const months: number[] = [];
    for (let m = Math.max(0, sm); m <= Math.min(11, em); m++) {
      months.push(m);
    }
    return {
      id: batch.id,
      name: batch.name,
      startDate: batch.startDate.toISOString(),
      endDate: batch.endDate.toISOString(),
      location: batch.location,
      requiredHours: batch.requiredHours,
      userCount: batch._count.batchUsers,
      status: computeBatchStatus(batch.startDate, batch.endDate),
      months,
      trainings: batch.trainings.map((t) => ({
        id: t.id,
        title: t.title,
        type: t.type,
        date: t.date.toISOString(),
        startTime: t.startTime,
        endTime: t.endTime,
      })),
    };
  });

  // 월별 통계
  const monthStats = Array.from({ length: 12 }, () => ({ batchCount: 0, trainingCount: 0 }));
  for (const b of batchData) {
    for (const m of b.months) {
      monthStats[m].batchCount++;
    }
    for (const t of b.trainings) {
      const tm = new Date(t.date).getMonth();
      monthStats[tm].trainingCount++;
    }
  }

  return (
    <div>
      <PageTitle
        title={`${year}년 연간 훈련 계획`}
        description="연간 차수 및 훈련 일정을 한눈에 확인합니다."
        actions={
          <div className="flex gap-2">
            <Link
              href={`/trainings/annual?year=${year - 1}`}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {year - 1}년
            </Link>
            <Link
              href={`/trainings/annual?year=${year + 1}`}
              className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              {year + 1}년
            </Link>
          </div>
        }
      />
      <AnnualClient year={year} batches={batchData} monthStats={monthStats} />
    </div>
  );
}
