import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

export default async function TrainingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  let batchFilter = {};
  if (session.user.role === "RESERVIST") {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.batchId) batchFilter = { batchId: user.batchId };
  }

  const trainings = await prisma.training.findMany({
    where: batchFilter,
    orderBy: { date: "asc" },
    include: {
      batch: { select: { name: true } },
      instructor: { select: { name: true } },
      attendances: session.user.role === "RESERVIST"
        ? { where: { userId: session.user.id } }
        : { select: { status: true } },
    },
  });

  const batches = isAdmin
    ? await prisma.batch.findMany({ orderBy: { startDate: "desc" } })
    : [];

  return (
    <div>
      <PageTitle
        title="훈련 일정"
        description="소집훈련 일정을 확인합니다."
        actions={
          isAdmin ? (
            <Link
              href="/trainings/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + 훈련 추가
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-3">
        {trainings.map((training) => {
          const date = new Date(training.date);
          const dateStr = date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
          const totalAttendances = training.attendances.length;
          const presentCount = training.attendances.filter((a) => a.status === "PRESENT").length;

          // 대상자 본인의 출석 상태
          const myAttendance = session.user.role === "RESERVIST" && training.attendances.length > 0
            ? training.attendances[0]
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
                    <span>{dateStr}</span>
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
                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                      myAttendance.status === "PRESENT" ? "bg-green-100 text-green-700" :
                      myAttendance.status === "ABSENT" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {ATTENDANCE_STATUS_LABELS[myAttendance.status]}
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-500">미정</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}

        {trainings.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">등록된 훈련이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
