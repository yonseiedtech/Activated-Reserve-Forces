import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
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
    unreadMessages,
    recentNotices,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "RESERVIST" } }),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
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
        where: { status: "ACTIVE" },
        select: { name: true },
      }),
    ]);
    instructorTodayTrainings = itt;
    instructorActiveBatchNames = iabn.map((b) => b.name);
  }

  // Reservist-specific data
  let nextTraining: { id: string; batchId: string; title: string; batchName: string; date: Date; dDay: number } | null = null;
  let mobileIdExpiringSoon = false;

  if (role === ROLES.RESERVIST) {
    const batchUserRecords = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    const batchIds = batchUserRecords.map((bu) => bu.batchId);

    if (batchIds.length > 0) {
      const nt = await prisma.training.findFirst({
        where: { batchId: { in: batchIds }, date: { gte: today } },
        orderBy: { date: "asc" },
        select: { id: true, title: true, date: true, batchId: true, batch: { select: { name: true } } },
      });

      if (nt) {
        const diffMs = nt.date.getTime() - today.getTime();
        nextTraining = {
          id: nt.id,
          batchId: nt.batchId,
          title: nt.title,
          batchName: nt.batch.name,
          date: nt.date,
          dDay: Math.ceil(diffMs / 86400000),
        };
      }
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
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" href="/admin/users" />
          <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" href="/admin/batches" />
          <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" href="/messages" />
        </div>
      )}
      {isInstructor && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" />
          <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" href="/batches" />
          <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" href="/messages" />
        </div>
      )}
      {role === ROLES.RESERVIST && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" href="/batches" />
          <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" href="/messages" />
        </div>
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

      {/* 대상자: 다음 훈련 D-Day 카드 */}
      {role === ROLES.RESERVIST && (
        <Link href={nextTraining ? `/batches/${nextTraining.batchId}` : "/batches"} className="block bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <span className="text-3xl">📅</span>
            <div>
              {nextTraining ? (
                <>
                  <p className="text-2xl font-bold text-blue-700">
                    D{nextTraining.dDay === 0 ? "-Day" : `-${nextTraining.dDay}`}
                  </p>
                  <p className="text-sm text-gray-700 font-medium">{nextTraining.batchName}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(nextTraining.date).toLocaleDateString("ko-KR")}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-500">예정된 훈련 없음</p>
                  <p className="text-xs text-gray-400">다음 훈련 일정이 등록되면 여기에 표시됩니다.</p>
                </>
              )}
            </div>
          </div>
        </Link>
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
