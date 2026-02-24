import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, BATCH_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const role = session.user.role;
  const isAdmin = role === ROLES.ADMIN || role === ROLES.MANAGER;
  const isInstructor = role === ROLES.INSTRUCTOR;

  const today = new Date(new Date().toDateString());
  const tomorrow = new Date(today.getTime() + 86400000);

  const [
    totalReservists,
    activeBatches,
    todayTrainings,
    unreadMessages,
    recentNotices,
    batches,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "RESERVIST" } }),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
    prisma.training.count({
      where: { date: { gte: today, lt: tomorrow } },
    }),
    prisma.message.count({
      where: { receiverId: session.user.id, isRead: false },
    }),
    prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.batch.findMany({
      orderBy: { startDate: "desc" },
      take: 5,
      include: { _count: { select: { batchUsers: true, trainings: true } } },
    }),
  ]);

  // Admin-specific data
  let pendingAttendance = 0;
  let pendingMobileIds = 0;
  let activeBatchNames: string[] = [];

  if (isAdmin) {
    const [pa, pmi, abn] = await Promise.all([
      prisma.attendance.count({
        where: {
          status: "PENDING",
          training: { date: { gte: today, lt: tomorrow } },
        },
      }),
      prisma.mobileIdCard.count({ where: { isApproved: false, rejectedAt: null } }),
      prisma.batch.findMany({
        where: { status: "ACTIVE" },
        select: { name: true },
      }),
    ]);
    pendingAttendance = pa;
    pendingMobileIds = pmi;
    activeBatchNames = abn.map((b) => b.name);
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
        where: { status: "ACTIVE" },
        select: { name: true },
      }),
    ]);
    instructorTodayTrainings = itt;
    instructorActiveBatchNames = iabn.map((b) => b.name);
  }

  // Reservist-specific data
  let nextTraining: { id: string; title: string; date: Date; dDay: number } | null = null;
  let todayCommute: { checkIn: boolean; checkOut: boolean } = { checkIn: false, checkOut: false };
  let attendanceRate = 0;
  let mobileIdExpiringSoon = false;
  let batchAttendanceInfo: { status: string; batch: { name: string; status: string } }[] = [];

  if (role === ROLES.RESERVIST) {
    const batchUserRecords = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    const batchIds = batchUserRecords.map((bu) => bu.batchId);

    if (batchIds.length > 0) {
      const [nt, cr, totalAtt, presentAtt] = await Promise.all([
        prisma.training.findFirst({
          where: { batchId: { in: batchIds }, date: { gte: today } },
          orderBy: { date: "asc" },
          select: { id: true, title: true, date: true },
        }),
        prisma.commutingRecord.findFirst({
          where: { userId: session.user.id, date: { gte: today, lt: tomorrow } },
        }),
        prisma.attendance.count({
          where: { userId: session.user.id },
        }),
        prisma.attendance.count({
          where: { userId: session.user.id, status: "PRESENT" },
        }),
      ]);

      if (nt) {
        const diffMs = nt.date.getTime() - today.getTime();
        nextTraining = {
          id: nt.id,
          title: nt.title,
          date: nt.date,
          dDay: Math.ceil(diffMs / 86400000),
        };
      }
      todayCommute = {
        checkIn: !!cr?.checkInAt,
        checkOut: !!cr?.checkOutAt,
      };
      attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
    }

    // Batch attendance status
    batchAttendanceInfo = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { status: true, batch: { select: { name: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" href="/admin/users" />
        )}
        {isInstructor && (
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" />
        )}
        <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" href={isAdmin ? "/admin/batches" : "/batches"} />
        <StatCard label="오늘 훈련" value={todayTrainings} icon="📅" color="yellow" href="/trainings" />
        <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" href="/messages" />
      </div>

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
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <div>
                  <p className="text-sm font-bold text-green-700">
                    {activeBatchNames.length > 0 ? activeBatchNames.join(", ") : "없음"}
                  </p>
                  <p className="text-xs text-gray-600">진행중 차수</p>
                </div>
              </div>
            </div>
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

      {/* 대상자: 내 훈련 현황 카드 */}
      {role === ROLES.RESERVIST && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">내 훈련 현황</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Link href="/trainings" className="block p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📅</span>
                <div>
                  {nextTraining ? (
                    <>
                      <p className="text-lg font-bold text-blue-700">
                        D{nextTraining.dDay === 0 ? "-Day" : `-${nextTraining.dDay}`}
                      </p>
                      <p className="text-xs text-gray-600">{nextTraining.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(nextTraining.date).toLocaleDateString("ko-KR")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-500">예정 없음</p>
                      <p className="text-xs text-gray-400">다음 훈련</p>
                    </>
                  )}
                </div>
              </div>
            </Link>
            <Link href="/commuting" className="block p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🕐</span>
                <div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${todayCommute.checkIn ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                      출근 {todayCommute.checkIn ? "완료" : "미완"}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${todayCommute.checkOut ? "bg-green-200 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                      퇴근 {todayCommute.checkOut ? "완료" : "미완"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">오늘 출퇴근</p>
                </div>
              </div>
            </Link>
            <Link href="/batches" className="block p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <p className="text-2xl font-bold text-yellow-700">{attendanceRate}%</p>
                  <p className="text-xs text-gray-600">내 출석률</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* 대상자: 차수 참석 신고 상태 */}
      {role === ROLES.RESERVIST && batchAttendanceInfo.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">차수 참석 신고 현황</h2>
          <div className="space-y-2">
            {batchAttendanceInfo.map((ba, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{ba.batch.name}</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  ba.status === "PRESENT" ? "bg-green-100 text-green-700" :
                  ba.status === "ABSENT" ? "bg-red-100 text-red-700" :
                  "bg-yellow-100 text-yellow-700"
                }`}>
                  {ba.status === "PRESENT" ? "참석" : ba.status === "ABSENT" ? "불참" : "미정"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* P2-13: 모바일 신분증 만료 경고 */}
      {role === ROLES.RESERVIST && mobileIdExpiringSoon && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">모바일 신분증 만료 예정</p>
            <p className="text-sm text-red-600">신분증이 3일 이내에 만료됩니다. 관리자에게 갱신을 요청하세요.</p>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* 차수 현황 */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">차수 현황</h2>
            {isAdmin && (
              <Link href="/admin/batches" className="text-sm text-blue-600 hover:underline">
                전체보기
              </Link>
            )}
          </div>
          <div className="space-y-3">
            {batches.map((batch) => (
              <Link key={batch.id} href={`/admin/batches/${batch.id}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div>
                  <p className="font-medium text-sm">{batch.name}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(batch.startDate).toLocaleDateString("ko-KR")} ~ {new Date(batch.endDate).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                    batch.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                    batch.status === "COMPLETED" ? "bg-gray-100 text-gray-600" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {BATCH_STATUS_LABELS[batch.status]}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{batch._count.batchUsers}명 / {batch._count.trainings}개 훈련</p>
                </div>
              </Link>
            ))}
            {batches.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">등록된 차수가 없습니다.</p>
            )}
          </div>
        </div>

        {/* 최근 공지사항 */}
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
