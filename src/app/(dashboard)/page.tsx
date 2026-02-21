import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, BATCH_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const role = session.user.role;

  const [
    totalReservists,
    activeBatches,
    todayTrainings,
    unreadNotices,
    unreadMessages,
    recentNotices,
    batches,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "RESERVIST" } }),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
    prisma.training.count({
      where: {
        date: {
          gte: new Date(new Date().toDateString()),
          lt: new Date(new Date(new Date().toDateString()).getTime() + 86400000),
        },
      },
    }),
    prisma.notice.count({ where: { isPinned: true } }),
    prisma.message.count({
      where: { receiverId: session.user.id, isRead: false },
    }),
    prisma.notice.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.batch.findMany({
      orderBy: { startDate: "desc" },
      take: 5,
      include: { _count: { select: { users: true, trainings: true } } },
    }),
  ]);

  const isAdmin = role === ROLES.ADMIN || role === ROLES.MANAGER;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">안녕하세요, {session.user.name}님</h1>
        <p className="text-gray-500 mt-1">상비예비군 소집훈련 관리 시스템에 오신 것을 환영합니다.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdmin && (
          <StatCard label="훈련 대상자" value={totalReservists} icon="👥" color="blue" />
        )}
        <StatCard label="진행중 차수" value={activeBatches} icon="📋" color="green" />
        <StatCard label="오늘 훈련" value={todayTrainings} icon="📅" color="yellow" />
        <StatCard label="읽지 않은 쪽지" value={unreadMessages} icon="✉️" color="red" />
      </div>

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
              <div key={batch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
                  <p className="text-xs text-gray-500 mt-1">{batch._count.users}명 / {batch._count.trainings}개 훈련</p>
                </div>
              </div>
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

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    yellow: "bg-yellow-50 border-yellow-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-gray-600">{label}</p>
        </div>
      </div>
    </div>
  );
}
