import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function computeBatchStatus(startDate: Date, endDate: Date): string {
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

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    PLANNED: { label: "계획", cls: "bg-gray-100 text-gray-600" },
    ACTIVE: { label: "진행중", cls: "bg-green-100 text-green-700" },
    COMPLETED: { label: "완료", cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] || map.PLANNED;
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
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

  // 월별 통계
  const monthStats: { batchCount: number; trainingCount: number; batchNames: string[] }[] = Array.from(
    { length: 12 },
    () => ({ batchCount: 0, trainingCount: 0, batchNames: [] })
  );

  for (const batch of batches) {
    const start = new Date(batch.startDate);
    const end = new Date(batch.endDate);
    const sm = start.getFullYear() === year ? start.getMonth() : 0;
    const em = end.getFullYear() === year ? end.getMonth() : 11;
    for (let m = Math.max(0, sm); m <= Math.min(11, em); m++) {
      monthStats[m].batchCount++;
      monthStats[m].batchNames.push(batch.name);
    }
    for (const t of batch.trainings) {
      const tm = new Date(t.date).getMonth();
      monthStats[tm].trainingCount++;
    }
  }

  const totalBatches = batches.length;
  const totalTrainings = batches.reduce((sum, b) => sum + b.trainings.length, 0);
  const totalPersonnel = batches.reduce((sum, b) => sum + b._count.batchUsers, 0);
  const currentMonth = now.getMonth();

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

      {/* 연간 요약 카드 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{totalBatches}</p>
          <p className="text-xs text-gray-500 mt-1">총 차수</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{totalTrainings}</p>
          <p className="text-xs text-gray-500 mt-1">총 훈련 과목</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-purple-600">{totalPersonnel}</p>
          <p className="text-xs text-gray-500 mt-1">총 훈련 인원</p>
        </div>
      </div>

      {/* 월별 타임라인 */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">월별 훈련 현황</h2>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-12 min-w-[700px]">
            {monthStats.map((stat, i) => {
              const isCurrentMonth = year === now.getFullYear() && i === currentMonth;
              return (
                <div
                  key={i}
                  className={`p-3 border-r last:border-r-0 text-center ${
                    isCurrentMonth ? "bg-blue-50 border-b-2 border-b-blue-500" : ""
                  } ${stat.batchCount > 0 ? "" : "opacity-50"}`}
                >
                  <p className={`text-xs font-bold mb-2 ${isCurrentMonth ? "text-blue-700" : "text-gray-600"}`}>
                    {MONTH_NAMES[i]}
                  </p>
                  {stat.batchCount > 0 ? (
                    <>
                      <p className="text-lg font-bold text-gray-800">{stat.batchCount}</p>
                      <p className="text-xs text-gray-400">차수</p>
                      <p className="text-xs text-green-600 mt-1">{stat.trainingCount}개 과목</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-300 mt-2">-</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 차수별 상세 */}
      {batches.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">{year}년에 등록된 훈련 차수가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((batch) => {
            const status = computeBatchStatus(batch.startDate, batch.endDate);
            const days = Math.ceil(
              (new Date(batch.endDate).getTime() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;

            // 날짜별 훈련 그룹핑
            const dateGroups: Record<string, typeof batch.trainings> = {};
            for (const t of batch.trainings) {
              const dk = new Date(t.date).toISOString().split("T")[0];
              if (!dateGroups[dk]) dateGroups[dk] = [];
              dateGroups[dk].push(t);
            }

            return (
              <div key={batch.id} className="bg-white rounded-xl border overflow-hidden">
                {/* 차수 헤더 */}
                <div className={`px-4 py-3 border-b flex items-center justify-between ${
                  status === "ACTIVE" ? "bg-green-50" : status === "COMPLETED" ? "bg-gray-50" : "bg-blue-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/batches/${batch.id}`} className="font-bold text-gray-800 hover:text-blue-600">
                      {batch.name}
                    </Link>
                    {statusBadge(status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatDate(batch.startDate)} ~ {formatDate(batch.endDate)} ({days}일)</span>
                    <span>{batch._count.batchUsers}명</span>
                    {batch.requiredHours && <span>{batch.requiredHours}시간</span>}
                    {batch.location && <span>{batch.location}</span>}
                  </div>
                </div>

                {/* 훈련 과목 목록 */}
                {batch.trainings.length > 0 ? (
                  <div className="divide-y">
                    {Object.entries(dateGroups).sort().map(([dateKey, trainings]) => {
                      const d = new Date(dateKey + "T00:00:00");
                      const dayLabel = d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div key={dateKey} className="px-4 py-2">
                          <div className="flex items-start gap-3">
                            <span className={`text-xs font-medium min-w-[90px] pt-0.5 ${isWeekend ? "text-red-500" : "text-gray-500"}`}>
                              {dayLabel}
                            </span>
                            <div className="flex-1 flex flex-wrap gap-1.5">
                              {trainings.map((t) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-xs"
                                >
                                  <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                                    {t.type}
                                  </span>
                                  <span className="text-gray-700">{t.title}</span>
                                  {t.startTime && t.endTime && (
                                    <span className="text-gray-400 font-mono">{t.startTime}~{t.endTime}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-xs text-gray-400 text-center">
                    등록된 훈련 과목이 없습니다.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
