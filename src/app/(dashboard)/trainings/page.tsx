import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

function calcDuration(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export default async function TrainingsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const resolvedParams = await searchParams;
  const isAdmin = ["ADMIN", "MANAGER", "INSTRUCTOR"].includes(session.user.role);
  const isReservist = session.user.role === "RESERVIST";

  // 월 필터링
  const now = new Date();
  const currentMonth = resolvedParams.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [year, month] = currentMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = `${year}년 ${month}월`;

  let batchFilter = {};
  if (isReservist) {
    const batchUserRecords = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    const batchIds = batchUserRecords.map((bu) => bu.batchId);
    if (batchIds.length > 0) batchFilter = { batchId: { in: batchIds } };
  }

  const trainings = await prisma.training.findMany({
    where: {
      ...batchFilter,
      date: { gte: monthStart, lt: monthEnd },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: {
      batch: { select: { id: true, name: true } },
      instructor: { select: { name: true } },
      attendances: isReservist
        ? { where: { userId: session.user.id } }
        : { select: { status: true } },
    },
  });

  // 차수별 → 날짜별 그룹핑
  const batchMap: Record<string, { batchName: string; batchId: string; dates: Record<string, typeof trainings> }> = {};

  for (const t of trainings) {
    const batchKey = t.batch.id;
    if (!batchMap[batchKey]) {
      batchMap[batchKey] = { batchName: t.batch.name, batchId: t.batch.id, dates: {} };
    }
    const dateKey = t.date.toISOString().split("T")[0];
    if (!batchMap[batchKey].dates[dateKey]) batchMap[batchKey].dates[dateKey] = [];
    batchMap[batchKey].dates[dateKey].push(t);
  }

  const batchEntries = Object.entries(batchMap);

  return (
    <div>
      <PageTitle
        title="세부 훈련 계획"
        description="차수별 세부 훈련 과목표입니다."
        actions={
          ["ADMIN", "MANAGER"].includes(session.user.role) ? (
            <Link
              href="/trainings/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + 훈련 추가
            </Link>
          ) : undefined
        }
      />

      {/* 월 이동 */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Link
          href={`/trainings?month=${prevMonth}`}
          className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          &lt;
        </Link>
        <span className="text-sm font-semibold text-gray-700 min-w-[100px] text-center">{monthLabel}</span>
        <Link
          href={`/trainings?month=${nextMonth}`}
          className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          &gt;
        </Link>
      </div>

      {batchEntries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg mb-4">이 달에 등록된 훈련이 없습니다.</p>
          {isAdmin && (
            <Link
              href="/trainings/new"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + 훈련 추가
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {batchEntries.map(([batchKey, batch]) => {
            const dateKeys = Object.keys(batch.dates).sort();
            return (
              <div key={batchKey}>
                {/* 차수 헤더 */}
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-bold text-gray-800">{batch.batchName}</h2>
                  <span className="text-xs text-gray-400">세부 훈련 계획</span>
                </div>

                <div className="space-y-4">
                  {dateKeys.map((dateKey) => {
                    const dayTrainings = batch.dates[dateKey];
                    const d = new Date(dateKey + "T00:00:00");
                    const dayOfWeek = d.toLocaleDateString("ko-KR", { weekday: "short" });
                    const dateLabel = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                    return (
                      <div key={dateKey} className="bg-white rounded-xl border overflow-hidden">
                        {/* 날짜 헤더 */}
                        <div className={`px-4 py-2.5 border-b flex items-center justify-between ${isWeekend ? "bg-red-50" : "bg-gray-50"}`}>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isWeekend ? "text-red-600" : "text-gray-800"}`}>
                              {dateLabel} ({dayOfWeek})
                            </span>
                            <span className="text-xs text-gray-400">
                              {dayTrainings.length}개 과목
                            </span>
                          </div>
                          <Link
                            href={`/trainings/schedule/${dateKey}?batchId=${batch.batchId}`}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            타임라인 &rarr;
                          </Link>
                        </div>

                        {/* 테이블: Desktop */}
                        <div className="hidden sm:block">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50/50">
                                <th className="text-left px-4 py-2 font-medium text-gray-500 w-[160px]">시각</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-500">세부 내용</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-500 w-[120px]">장소</th>
                                <th className="text-left px-4 py-2 font-medium text-gray-500 w-[100px]">교관</th>
                                {isReservist && (
                                  <th className="text-center px-4 py-2 font-medium text-gray-500 w-[80px]">출석</th>
                                )}
                                {isAdmin && (
                                  <th className="text-center px-4 py-2 font-medium text-gray-500 w-[80px]">참석</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {dayTrainings.map((training) => {
                                const duration = calcDuration(training.startTime, training.endTime);
                                const totalAttendances = training.attendances.length;
                                const presentCount = training.attendances.filter((a) => a.status === "PRESENT").length;
                                const myAttendance = isReservist && training.attendances.length > 0
                                  ? (training.attendances[0] as { status: string })
                                  : null;

                                const linkHref = isAdmin ? `/attendance/${training.id}` : `/trainings/${training.id}`;

                                return (
                                  <tr key={training.id} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-4 py-2.5 align-top">
                                      <Link href={linkHref} className="block">
                                        <div className="font-mono text-gray-800 font-medium text-xs">
                                          {training.startTime || "—"} ~ {training.endTime || "—"}
                                        </div>
                                        {duration > 0 && (
                                          <span className="text-[11px] text-gray-400">({duration}&apos;)</span>
                                        )}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-2.5 align-top">
                                      <Link href={linkHref} className="block">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
                                            {training.type}
                                          </span>
                                          <span className="font-semibold text-gray-900">{training.title}</span>
                                        </div>
                                        {training.description && (
                                          <p className="text-xs text-gray-500 line-clamp-2">{training.description}</p>
                                        )}
                                      </Link>
                                    </td>
                                    <td className="px-4 py-2.5 align-top text-gray-600">
                                      {training.location || "—"}
                                    </td>
                                    <td className="px-4 py-2.5 align-top text-gray-600">
                                      {training.instructor?.name || "—"}
                                    </td>
                                    {isReservist && (
                                      <td className="px-4 py-2.5 align-top text-center">
                                        {myAttendance ? (
                                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                            myAttendance.status === "PRESENT" ? "bg-green-100 text-green-700" :
                                            myAttendance.status === "ABSENT" ? "bg-red-100 text-red-700" :
                                            "bg-gray-100 text-gray-600"
                                          }`}>
                                            {ATTENDANCE_STATUS_LABELS[myAttendance.status]}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-gray-400">—</span>
                                        )}
                                      </td>
                                    )}
                                    {isAdmin && (
                                      <td className="px-4 py-2.5 align-top text-center">
                                        <Link href={`/attendance/${training.id}`} className="text-xs font-medium text-gray-700">
                                          {presentCount}/{totalAttendances}
                                        </Link>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* 모바일: 카드 리스트 */}
                        <div className="sm:hidden divide-y">
                          {dayTrainings.map((training) => {
                            const duration = calcDuration(training.startTime, training.endTime);
                            const totalAttendances = training.attendances.length;
                            const presentCount = training.attendances.filter((a) => a.status === "PRESENT").length;
                            const myAttendance = isReservist && training.attendances.length > 0
                              ? (training.attendances[0] as { status: string })
                              : null;

                            const linkHref = isAdmin ? `/attendance/${training.id}` : `/trainings/${training.id}`;

                            return (
                              <Link key={training.id} href={linkHref} className="block px-4 py-3 hover:bg-blue-50/30 transition-colors">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="font-mono text-xs font-medium text-gray-800">
                                    {training.startTime || "—"} ~ {training.endTime || "—"}
                                    {duration > 0 && (
                                      <span className="text-gray-400 ml-1">({duration}&apos;)</span>
                                    )}
                                  </div>
                                  {isReservist && myAttendance && (
                                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                                      myAttendance.status === "PRESENT" ? "bg-green-100 text-green-700" :
                                      myAttendance.status === "ABSENT" ? "bg-red-100 text-red-700" :
                                      "bg-gray-100 text-gray-600"
                                    }`}>
                                      {ATTENDANCE_STATUS_LABELS[myAttendance.status]}
                                    </span>
                                  )}
                                  {isAdmin && (
                                    <span className="text-xs text-gray-500">{presentCount}/{totalAttendances}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-medium">
                                    {training.type}
                                  </span>
                                  <span className="font-semibold text-sm text-gray-900">{training.title}</span>
                                </div>
                                {training.description && (
                                  <p className="text-xs text-gray-500 line-clamp-1 mb-1">{training.description}</p>
                                )}
                                <div className="flex gap-3 text-xs text-gray-400">
                                  {training.location && <span>{training.location}</span>}
                                  {training.instructor && <span>교관: {training.instructor.name}</span>}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
