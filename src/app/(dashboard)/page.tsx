import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { getKstToday } from "@/lib/date-utils";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const role = session.user.role;
  const isAdmin = role === ROLES.ADMIN || role === ROLES.MANAGER;
  const isInstructor = role === ROLES.INSTRUCTOR;

  const today = getKstToday();
  const tomorrow = new Date(today.getTime() + 86400000);

  const [
    totalReservists,
    activeBatches,
    unreadMessages,
    recentNotices,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "RESERVIST" } }),
    prisma.batch.count({ where: { startDate: { lte: today }, endDate: { gte: today } } }),
    prisma.message.count({
      where: { receiverId: session.user.id, isRead: false },
    }),
    prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
  ]);

  // Admin-specific data
  let pendingAttendance = 0;
  let pendingMobileIds = 0;
  let pendingDinnerRequests = 0;

  if (isAdmin) {
    const [pa, pmi, pdr] = await Promise.all([
      prisma.attendance.count({
        where: {
          status: "PENDING",
          training: { date: { gte: today, lt: tomorrow } },
        },
      }),
      prisma.mobileIdCard.count({ where: { isApproved: false, rejectedAt: null } }),
      prisma.dinnerRequest.count({ where: { status: "PENDING" } }),
    ]);
    pendingAttendance = pa;
    pendingMobileIds = pmi;
    pendingDinnerRequests = pdr;
  }

  // Instructor-specific data
  let instructorTodayTrainings = 0;
  let instructorActiveBatchNames: string[] = [];

  if (isInstructor) {
    const [itt, iabn] = await Promise.all([
      prisma.training.count({
        where: { date: { gte: today, lt: tomorrow }, instructorId: session.user.id },
      }),
      prisma.batch.findMany({
        where: { startDate: { lte: today }, endDate: { gte: today } },
        select: { name: true },
      }),
    ]);
    instructorTodayTrainings = itt;
    instructorActiveBatchNames = iabn.map((b) => b.name);
  }

  // Reservist-specific data
  let nextTraining: { id: string; batchId: string; title: string; batchName: string; date: Date; dDay: number } | null = null;
  let mobileIdExpiringSoon = false;
  let attendanceRate = 0;
  let totalAttendances = 0;
  let presentAttendances = 0;
  let upcomingBatches: { id: string; name: string; startDate: Date; endDate: Date; status: string }[] = [];
  let completedBatchCount = 0;

  if (role === ROLES.RESERVIST) {
    const batchUserRecords = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    const batchIds = batchUserRecords.map((bu) => bu.batchId);

    if (batchIds.length > 0) {
      // 다음 훈련
      const nt = await prisma.training.findFirst({
        where: { batchId: { in: batchIds }, date: { gte: today } },
        orderBy: { date: "asc" },
        select: { id: true, title: true, date: true, batchId: true, batch: { select: { name: true } } },
      });

      if (nt) {
        const trainingDateOnly = new Date(nt.date.toISOString().slice(0, 10) + "T00:00:00");
        const todayOnly = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
        const diffDays = Math.round((trainingDateOnly.getTime() - todayOnly.getTime()) / 86400000);
        nextTraining = {
          id: nt.id,
          batchId: nt.batchId,
          title: nt.title,
          batchName: nt.batch.name,
          date: nt.date,
          dDay: diffDays,
        };
      }

      // 누적 참석률 (전체 차수의 내 출석 데이터)
      const myAttendances = await prisma.attendance.findMany({
        where: {
          userId: session.user.id,
          training: { batchId: { in: batchIds } },
        },
        select: { status: true },
      });
      totalAttendances = myAttendances.length;
      presentAttendances = myAttendances.filter((a) => a.status === "PRESENT").length;
      attendanceRate = totalAttendances > 0 ? Math.round((presentAttendances / totalAttendances) * 100) : 0;

      // 진행중+예정 차수 (endDate >= today)
      const batches = await prisma.batch.findMany({
        where: { id: { in: batchIds }, endDate: { gte: today } },
        orderBy: { startDate: "asc" },
        select: { id: true, name: true, startDate: true, endDate: true, status: true },
      });
      upcomingBatches = batches;

      // 완료 차수
      completedBatchCount = await prisma.batch.count({
        where: { id: { in: batchIds }, endDate: { lt: today } },
      });
    }

    // Mobile ID expiry check (D-3)
    const mobileId = await prisma.mobileIdCard.findUnique({
      where: { userId: session.user.id },
      select: { validUntil: true, isApproved: true },
    });
    if (mobileId?.isApproved) {
      const daysUntilExpiry = Math.ceil((mobileId.validUntil.getTime() - today.getTime()) / 86400000);
      mobileIdExpiringSoon = daysUntilExpiry <= 3 && daysUntilExpiry >= 0;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">안녕하세요, {session.user.name}님</h1>
        <p className="text-gray-500 mt-1">상비예비군 소집훈련 관리 시스템에 오신 것을 환영합니다.</p>
      </div>

      {/* 통계 카드 */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" href="/admin/users" />
          <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" href="/admin/batches" />
          <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" href="/messages" />
        </div>
      )}
      {isInstructor && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" />
          <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" href="/batches" />
          <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" href="/messages" />
        </div>
      )}

      {/* RESERVIST 대시보드 */}
      {role === ROLES.RESERVIST && (
        <>
          {/* 참석률 + 차수 요약 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className={`text-3xl font-bold ${attendanceRate >= 80 ? "text-green-600" : attendanceRate >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                {attendanceRate}%
              </p>
              <p className="text-xs text-gray-500 mt-1">누적 참석률</p>
              <p className="text-[10px] text-gray-400">{presentAttendances}/{totalAttendances}</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{upcomingBatches.filter((b) => b.status === "ACTIVE").length}</p>
              <p className="text-xs text-gray-500 mt-1">진행중</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-3xl font-bold text-gray-400">{upcomingBatches.filter((b) => b.status === "PLANNED").length}</p>
              <p className="text-xs text-gray-500 mt-1">예정</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-3xl font-bold text-blue-500">{completedBatchCount}</p>
              <p className="text-xs text-gray-500 mt-1">완료</p>
            </div>
          </div>

          {/* 예정 / 진행중 차수 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">예정 / 진행중 차수</h2>
            {upcomingBatches.length > 0 ? (
              <div className="space-y-2">
                {upcomingBatches.map((batch) => (
                  <Link
                    key={batch.id}
                    href={`/batches/${batch.id}`}
                    className={`block rounded-xl border p-4 hover:shadow-sm transition-shadow ${
                      batch.status === "ACTIVE"
                        ? "bg-green-50 border-green-200"
                        : "bg-yellow-50 border-yellow-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span
                        className={`px-2 py-0.5 text-white text-xs rounded-full font-medium ${
                          batch.status === "ACTIVE" ? "bg-green-600" : "bg-yellow-500"
                        }`}
                      >
                        {batch.status === "ACTIVE" ? "진행중" : "예정"}
                      </span>
                      <span className={`font-bold ${batch.status === "ACTIVE" ? "text-green-800" : "text-yellow-800"}`}>
                        {batch.name}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {new Date(batch.startDate).toLocaleDateString("ko-KR")} ~ {new Date(batch.endDate).toLocaleDateString("ko-KR")}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-5 text-center">
                <p className="text-gray-400">예정된 차수가 없습니다.</p>
              </div>
            )}
          </div>

          {/* 다음 훈련 D-Day */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">다음 훈련</h2>
            <Link href={nextTraining ? `/batches/${nextTraining.batchId}` : "/batches"} className="block bg-white rounded-xl border p-5 hover:shadow-sm transition-shadow">
              {nextTraining ? (
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-blue-700 font-bold text-sm">
                      {nextTraining.dDay === 0 ? "D-Day" : `D-${nextTraining.dDay}`}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{nextTraining.batchName}</p>
                    <p className="text-sm text-gray-500">{nextTraining.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(nextTraining.date).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-gray-400">예정된 훈련이 없습니다.</p>
                </div>
              )}
            </Link>
          </div>

          {/* 읽지 않은 쪽지 */}
          {unreadMessages > 0 && (
            <Link href="/messages" className="block bg-red-50 rounded-xl border border-red-200 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <span className="text-xl">✉️</span>
                <div>
                  <p className="font-medium text-red-700">읽지 않은 쪽지 {unreadMessages}건</p>
                </div>
              </div>
            </Link>
          )}
        </>
      )}

      {/* 운영자: 오늘의 할 일 패널 */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">오늘의 할 일</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link href="/attendance" className="block p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-2xl font-bold text-orange-700">{pendingAttendance}</p>
                  <p className="text-xs text-gray-600">미처리 출석 건수</p>
                </div>
              </div>
            </Link>
            <Link href="/mobile-id" className="block p-4 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🪪</span>
                <div>
                  <p className="text-2xl font-bold text-purple-700">{pendingMobileIds}</p>
                  <p className="text-xs text-gray-600">승인 대기 신분증</p>
                </div>
              </div>
            </Link>
            <Link href="/meals" className="block p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍽️</span>
                <div>
                  <p className="text-2xl font-bold text-yellow-700">{pendingDinnerRequests}</p>
                  <p className="text-xs text-gray-600">석식 신청 대기</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* 교관: 오늘의 현황 패널 */}
      {isInstructor && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">교관 현황</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link href="/trainings" className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{instructorTodayTrainings}</p>
                  <p className="text-xs text-gray-600">오늘 담당 훈련</p>
                </div>
              </div>
            </Link>
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-green-700">
                    {instructorActiveBatchNames.length > 0 ? instructorActiveBatchNames.join(", ") : "없음"}
                  </p>
                  <p className="text-xs text-gray-600">진행중 차수</p>
                </div>
              </div>
            </div>
            <Link href="/commuting" className="block p-4 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-sm font-bold text-orange-700">출석 관리</p>
                  <p className="text-xs text-gray-600">훈련 과목별 출석 체크</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* 모바일 신분증 만료 경고 */}
      {role === ROLES.RESERVIST && mobileIdExpiringSoon && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">모바일 신분증 만료 예정</p>
            <p className="text-sm text-red-600">신분증이 3일 이내에 만료됩니다. 관리자에게 갱신을 요청하세요.</p>
          </div>
        </div>
      )}

      {/* 최근 공지사항 (전체 너비) */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">최근 공지사항</h2>
          <Link href="/notices" className="text-sm text-blue-600 hover:underline">
            전체보기
          </Link>
        </div>
        <div className="space-y-3">
          {recentNotices.map((notice) => (
            <Link
              key={notice.id}
              href={`/notices/${notice.id}`}
              className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start gap-2">
                {notice.isPinned && <span className="text-red-500 text-xs mt-0.5">📌</span>}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{notice.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(notice.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          {recentNotices.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">등록된 공지사항이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, href }: { label: string; value: number; icon: string; color: string; href?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
  };

  const content = (
    <div className="flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-gray-600">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={`rounded-xl border p-4 ${colorMap[color]} hover:shadow-sm transition-shadow`}>
        {content}
      </Link>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      {content}
    </div>
  );
}
