import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

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
    orderBy: { date: "asc" },
    include: {
      batch: { select: { id: true, name: true } },
      instructor: { select: { name: true } },
      attendances: isReservist
        ? { where: { userId: session.user.id } }
        : { select: { status: true } },
    },
  });

  const batches = isAdmin
    ? await prisma.batch.findMany({ orderBy: { startDate: "desc" } })
    : [];

  // 날짜별 그룹핑
  const grouped: Record<string, typeof trainings> = {};
  for (const t of trainings) {
    const dateKey = t.date.toISOString().split("T")[0];
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(t);
  }
  const dateKeys = Object.keys(grouped).sort();

  return (
    <div>
      <PageTitle
        title="훈련 과목"
        description="소집훈련 과목을 확인합니다."
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

      <div className="space-y-6">
        {dateKeys.map((dateKey) => {
          const dayTrainings = grouped[dateKey];
          const d = new Date(dateKey + "T00:00:00");
          const headerStr = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });
          const firstBatchId = dayTrainings[0]?.batch?.id;

          return (
            <div key={dateKey}>
              {/* 날짜 헤더 */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">{headerStr}</h3>
                <Link
                  href={`/trainings/schedule/${dateKey}${firstBatchId ? `?batchId=${firstBatchId}` : ""}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  일일 일정 보기 &rarr;
                </Link>
              </div>

              <div className="space-y-3">
                {dayTrainings.map((training) => {
                  const totalAttendances = training.attendances.length;
                  const presentCount = training.attendances.filter((a) => a.status === "PRESENT").length;

                  const myAttendance = isReservist && training.attendances.length > 0
                    ? (training.attendances[0] as { status: string; earlyLeaveTime?: string | null; expectedConfirmAt?: Date | string | null })
                    : null;

                  return (
                    <Link
                      key={training.id}
                      href={isAdmin ? `/attendance/${training.id}` : `/trainings/${training.id}`}
                      className="block bg-white rounded-xl border p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                              {training.type}
                            </span>
                            <span className="text-xs text-gray-400">{training.batch.name}</span>
                          </div>
                          <h3 className="font-semibold text-gray-900">{training.title}</h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-500">
                            {training.startTime && <span>{training.startTime} ~ {training.endTime}</span>}
                            {training.location && <span>{training.location}</span>}
                            {training.instructor && <span>교관: {training.instructor.name}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isAdmin ? (
                            <div>
                              <p className="text-sm font-medium">{presentCount}/{totalAttendances}</p>
                              <p className="text-xs text-gray-400">참석</p>
                            </div>
                          ) : myAttendance ? (
                            <div className="text-right">
                              <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                myAttendance.status === "PRESENT" ? "bg-green-100 text-green-700" :
                                myAttendance.status === "ABSENT" ? "bg-red-100 text-red-700" :
                                "bg-gray-100 text-gray-600"
                              }`}>
                                {ATTENDANCE_STATUS_LABELS[myAttendance.status]}
                              </span>
                              {myAttendance.status === "PRESENT" && myAttendance.earlyLeaveTime && (
                                <p className="text-xs text-orange-600 mt-1">(조기퇴소 {myAttendance.earlyLeaveTime})</p>
                              )}
                              {myAttendance.status === "PENDING" && myAttendance.expectedConfirmAt && (
                                <p className="text-xs text-gray-500 mt-1">
                                  확정 예정: {new Date(myAttendance.expectedConfirmAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}{" "}
                                  {new Date(myAttendance.expectedConfirmAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">미정</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        {trainings.length === 0 && (
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
        )}
      </div>
    </div>
  );
}
