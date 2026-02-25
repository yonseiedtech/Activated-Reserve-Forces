"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";

interface BatchSummary {
  present: number;
  absent: number;
  pending: number;
  total: number;
  rate: number;
}

interface DayTypeAgg {
  present: number;
  absent: number;
  pending: number;
  total: number;
  batchCount: number;
  trainingCount: number;
  rate: number;
}

interface UserStat {
  userId: string;
  name: string;
  rank: string | null;
  present: number;
  absent: number;
  pending: number;
  total: number;
  rate: number;
}

interface BatchReport {
  batchId: string;
  batchName: string;
  status: string;
  startDate: string;
  endDate: string;
  totalUsers: number;
  totalTrainings: number;
  batchDayType: "weekday" | "weekend";
  requiredHours: number | null;
  summary: BatchSummary;
  byUser: UserStat[];
  batchUserMap: Record<string, { status: string; subStatus: string | null; reason: string | null }>;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<string, string> = {
  PLANNED: "계획",
  ACTIVE: "진행중",
  COMPLETED: "완료",
};

function RateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? "bg-green-100 text-green-700" :
    rate >= 50 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{rate}%</span>;
}

function RateBar({ rate, size = "md" }: { rate: number; size?: "sm" | "md" }) {
  const color = rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";
  const h = size === "sm" ? "h-1.5" : "h-2";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${h} bg-gray-100 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600 w-10 text-right">{rate}%</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// 관리자/교관용 뷰
// ═══════════════════════════════════════════

function DayTypeCard({ label, stat, badge }: { label: string; stat: DayTypeAgg | null; badge?: string }) {
  if (!stat) return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-semibold text-sm">{label}</h4>
        {badge && <span className="text-[10px] text-gray-400">{badge}</span>}
      </div>
      <p className="text-sm text-gray-400">데이터 없음</p>
    </div>
  );
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-sm">{label}</h4>
          {badge && <span className="text-[10px] text-gray-400">{badge}</span>}
        </div>
        <RateBadge rate={stat.rate} />
      </div>
      <RateBar rate={stat.rate} />
      <div className="flex gap-4 mt-2 text-xs text-gray-500">
        <span>{stat.batchCount}개 차수 · {stat.trainingCount}개 과목</span>
        <span>참석 <span className="text-green-600 font-medium">{stat.present}</span></span>
        <span>불참 <span className="text-red-600 font-medium">{stat.absent}</span></span>
        <span>미정 <span className="font-medium">{stat.pending}</span></span>
      </div>
    </div>
  );
}

function UserTable({ users, label, count }: { users: UserStat[]; label: string; count: number }) {
  const sorted = [...users].sort((a, b) => b.rate - a.rate);
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs text-gray-500">{count}명</span>
      </div>

      {/* Desktop */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs border-b">
              <th className="px-4 py-2 font-medium w-8">#</th>
              <th className="px-4 py-2 font-medium">이름</th>
              <th className="px-4 py-2 font-medium text-center">참석</th>
              <th className="px-4 py-2 font-medium text-center">불참</th>
              <th className="px-4 py-2 font-medium text-center">미정</th>
              <th className="px-4 py-2 font-medium w-44">출석률</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">출석 데이터가 없습니다.</td></tr>
            ) : (
              sorted.map((u, i) => (
                <tr key={u.userId} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{u.name}</span>
                    {u.rank && <span className="ml-1 text-xs text-gray-500">{u.rank}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-center text-green-600 font-medium">{u.present}</td>
                  <td className="px-4 py-2.5 text-center text-red-600 font-medium">{u.absent}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500">{u.pending}</td>
                  <td className="px-4 py-2.5">
                    <RateBar rate={u.rate} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="lg:hidden divide-y">
        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400">출석 데이터가 없습니다.</p>
        ) : (
          sorted.map((u, i) => (
            <div key={u.userId} className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-5">{i + 1}</span>
                  <span className="font-medium text-sm">{u.name}</span>
                  {u.rank && <span className="text-xs text-gray-500">{u.rank}</span>}
                </div>
                <RateBadge rate={u.rate} />
              </div>
              <div className="flex gap-3 text-xs text-gray-500 mb-2 ml-7">
                <span>참석 <span className="text-green-600 font-medium">{u.present}</span></span>
                <span>불참 <span className="text-red-600 font-medium">{u.absent}</span></span>
                <span>미정 <span className="font-medium">{u.pending}</span></span>
              </div>
              <div className="ml-7">
                <RateBar rate={u.rate} size="sm" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

type AdminTab = "batch" | "daytype" | "person";

const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: "batch", label: "차수별 출석률" },
  { key: "daytype", label: "평일/주말 출석률" },
  { key: "person", label: "인원별 출석률" },
];

function AdminReportView({ reports }: { reports: BatchReport[] }) {
  const [tab, setTab] = useState<AdminTab>("batch");

  const totalPresent = reports.reduce((s, r) => s + r.summary.present, 0);
  const totalAtt = reports.reduce((s, r) => s + r.summary.total, 0);
  const totalRate = totalAtt > 0 ? Math.round((totalPresent / totalAtt) * 100) : 0;

  // 차수의 batchDayType 기준으로 평일/주말 집계
  const weekdayBatches = reports.filter((r) => r.batchDayType === "weekday");
  const weekendBatches = reports.filter((r) => r.batchDayType === "weekend");

  function aggDayType(batches: BatchReport[]): DayTypeAgg | null {
    if (batches.length === 0) return null;
    const present = batches.reduce((s, r) => s + r.summary.present, 0);
    const absent = batches.reduce((s, r) => s + r.summary.absent, 0);
    const pending = batches.reduce((s, r) => s + r.summary.pending, 0);
    const total = batches.reduce((s, r) => s + r.summary.total, 0);
    const trainingCount = batches.reduce((s, r) => s + r.totalTrainings, 0);
    return {
      present, absent, pending, total,
      batchCount: batches.length,
      trainingCount,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  const totalDayTypeData = {
    weekday: aggDayType(weekdayBatches),
    weekend: aggDayType(weekendBatches),
  };

  const userMap: Record<string, UserStat> = {};
  for (const r of reports) {
    for (const u of r.byUser) {
      if (!userMap[u.userId]) {
        userMap[u.userId] = { ...u, present: 0, absent: 0, pending: 0, total: 0, rate: 0 };
      }
      userMap[u.userId].present += u.present;
      userMap[u.userId].absent += u.absent;
      userMap[u.userId].pending += u.pending;
      userMap[u.userId].total += u.total;
    }
  }
  const totalUsers = Object.values(userMap).map((u) => ({
    ...u,
    rate: u.total > 0 ? Math.round((u.present / u.total) * 100) : 0,
  }));

  return (
    <>
      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-6 bg-gray-50/80 rounded-lg p-1 overflow-x-auto">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 min-w-fit px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? "bg-white shadow-sm text-blue-600"
                : "text-gray-500 hover:text-gray-800 hover:bg-white/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 1: 차수별 출석률 */}
      {tab === "batch" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">전체 종합</h3>
              <RateBadge rate={totalRate} />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div>
                <p className="text-xs text-gray-500">총 차수</p>
                <p className="text-lg font-bold text-gray-800">{reports.length}개</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">총 훈련 과목</p>
                <p className="text-lg font-bold text-gray-800">{reports.reduce((s, r) => s + r.totalTrainings, 0)}개</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">총 참석</p>
                <p className="text-lg font-bold text-gray-800">
                  <span className="text-green-600">{totalPresent}</span>
                  <span className="text-gray-400 text-sm">/{totalAtt}</span>
                </p>
              </div>
            </div>
            <RateBar rate={totalRate} />
          </div>

          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.batchId} className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{r.batchName}</h4>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || "bg-gray-100"}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                  <RateBadge rate={r.summary.rate} />
                </div>
                <div className="grid grid-cols-4 gap-3 text-center text-xs mb-3">
                  <div>
                    <p className="text-gray-500">대상 인원</p>
                    <p className="font-bold text-gray-800">{r.totalUsers}명</p>
                  </div>
                  <div>
                    <p className="text-gray-500">훈련 과목</p>
                    <p className="font-bold text-gray-800">{r.totalTrainings}개</p>
                  </div>
                  <div>
                    <p className="text-gray-500">참석</p>
                    <p className="font-bold text-green-600">{r.summary.present}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">불참</p>
                    <p className="font-bold text-red-600">{r.summary.absent}</p>
                  </div>
                </div>
                <RateBar rate={r.summary.rate} />
                <p className="text-[11px] text-gray-400 mt-2">
                  {r.startDate.split("T")[0]} ~ {r.endDate.split("T")[0]}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 탭 2: 평일/주말 출석률 */}
      {tab === "daytype" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-base font-bold mb-3">평일 차수 출석률</h2>
            <div className="space-y-3">
              <DayTypeCard label="평일 종합" stat={totalDayTypeData.weekday} />
              {weekdayBatches.map((r) => {
                const batchAgg: DayTypeAgg = {
                  ...r.summary,
                  batchCount: 1,
                  trainingCount: r.totalTrainings,
                  rate: r.summary.rate,
                };
                return (
                  <DayTypeCard
                    key={r.batchId}
                    label={r.batchName}
                    stat={batchAgg}
                    badge={STATUS_LABELS[r.status] || r.status}
                  />
                );
              })}
            </div>
          </div>
          <div>
            <h2 className="text-base font-bold mb-3">주말 차수 출석률</h2>
            <div className="space-y-3">
              <DayTypeCard label="주말 종합" stat={totalDayTypeData.weekend} />
              {weekendBatches.map((r) => {
                const batchAgg: DayTypeAgg = {
                  ...r.summary,
                  batchCount: 1,
                  trainingCount: r.totalTrainings,
                  rate: r.summary.rate,
                };
                return (
                  <DayTypeCard
                    key={r.batchId}
                    label={r.batchName}
                    stat={batchAgg}
                    badge={STATUS_LABELS[r.status] || r.status}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 탭 3: 인원별 출석률 */}
      {tab === "person" && (
        <div className="space-y-6">
          <UserTable users={totalUsers} label="전체 종합" count={totalUsers.length} />
          {reports.map((r) => (
            <div key={r.batchId}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || "bg-gray-100"}`}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
              </div>
              <UserTable users={r.byUser} label={r.batchName} count={r.byUser.length} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════
// 예비역(훈련 대상자)용 뷰 - 차수 기준 리스트
// ═══════════════════════════════════════════

const RESERVIST_SUB_STATUS_LABELS: Record<string, string> = {
  LATE_ARRIVAL: "지연입소",
  EARLY_DEPARTURE: "조기퇴소",
};

function ReservistReportView({ reports, userId }: { reports: BatchReport[]; userId: string }) {
  if (reports.length === 0) {
    return <div className="text-center py-16 text-gray-400">배정된 차수가 없습니다.</div>;
  }

  const totalBatches = reports.length;
  const presentBatches = reports.filter((r) => r.batchUserMap?.[userId]?.status === "PRESENT").length;
  const absentBatches = reports.filter((r) => r.batchUserMap?.[userId]?.status === "ABSENT").length;
  const pendingBatches = totalBatches - presentBatches - absentBatches;

  return (
    <div className="space-y-4">
      {/* 종합 요약 */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold mb-3">소집훈련 현황 종합</h3>
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-xs text-gray-500">전체 차수</p>
            <p className="text-lg font-bold text-gray-800">{totalBatches}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">참석</p>
            <p className="text-lg font-bold text-green-600">{presentBatches}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">불참</p>
            <p className="text-lg font-bold text-red-600">{absentBatches}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">미정</p>
            <p className="text-lg font-bold text-gray-500">{pendingBatches}</p>
          </div>
        </div>
      </div>

      {/* 차수별 리스트 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Desktop: 테이블 */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs border-b bg-gray-50">
                <th className="px-4 py-3 font-medium">구분</th>
                <th className="px-4 py-3 font-medium">차수명</th>
                <th className="px-4 py-3 font-medium">훈련일</th>
                <th className="px-4 py-3 font-medium text-center">참석</th>
                <th className="px-4 py-3 font-medium text-center">이수시간</th>
                <th className="px-4 py-3 font-medium">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map((r) => {
                const bu = r.batchUserMap?.[userId];
                const buStatus = bu?.status || "PENDING";
                const subStatus = bu?.subStatus;
                const buReason = bu?.reason;
                const dt = new Date(r.startDate);
                const days = ["일", "월", "화", "수", "목", "금", "토"];
                const dateStr = `${String(dt.getMonth() + 1).padStart(2, "0")}. ${String(dt.getDate()).padStart(2, "0")}. (${days[dt.getDay()]})`;

                let statusLabel = "미정";
                let statusColor = "bg-gray-100 text-gray-600";
                if (buStatus === "PRESENT") { statusLabel = "참석"; statusColor = "bg-green-100 text-green-700"; }
                else if (buStatus === "ABSENT") { statusLabel = "불참"; statusColor = "bg-red-100 text-red-700"; }

                const remark = subStatus && subStatus !== "NORMAL"
                  ? RESERVIST_SUB_STATUS_LABELS[subStatus] || subStatus
                  : buStatus === "ABSENT" && buReason ? buReason : "";

                return (
                  <tr key={r.batchId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.batchDayType === "weekend" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                        {r.batchDayType === "weekend" ? "주말" : "평일"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{r.batchName}</td>
                    <td className="px-4 py-3 text-gray-600">{dateStr}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700 font-medium">
                      {r.requiredHours ? `${r.requiredHours}시간` : "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{remark}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: 카드 리스트 */}
        <div className="lg:hidden divide-y">
          {reports.map((r) => {
            const bu = r.batchUserMap?.[userId];
            const buStatus = bu?.status || "PENDING";
            const subStatus = bu?.subStatus;
            const buReason = bu?.reason;
            const dt = new Date(r.startDate);
            const days = ["일", "월", "화", "수", "목", "금", "토"];
            const dateStr = `${String(dt.getMonth() + 1).padStart(2, "0")}. ${String(dt.getDate()).padStart(2, "0")}. (${days[dt.getDay()]})`;

            let statusLabel = "미정";
            let statusColor = "bg-gray-100 text-gray-600";
            if (buStatus === "PRESENT") { statusLabel = "참석"; statusColor = "bg-green-100 text-green-700"; }
            else if (buStatus === "ABSENT") { statusLabel = "불참"; statusColor = "bg-red-100 text-red-700"; }

            const remark = subStatus && subStatus !== "NORMAL"
              ? RESERVIST_SUB_STATUS_LABELS[subStatus] || subStatus
              : buStatus === "ABSENT" && buReason ? buReason : "";

            return (
              <div key={r.batchId} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.batchDayType === "weekend" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                      {r.batchDayType === "weekend" ? "주말" : "평일"}
                    </span>
                    <span className="font-medium text-sm">{r.batchName}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{dateStr}</span>
                  <span>{r.requiredHours ? `${r.requiredHours}시간` : "-"}</span>
                  {remark && <span className="text-orange-600">{remark}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 메인 페이지
// ═══════════════════════════════════════════

export default function AttendanceReportPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [loading, setLoading] = useState(true);

  const isReservist = session?.user?.role === "RESERVIST";

  useEffect(() => {
    fetch("/api/attendance-report")
      .then((r) => r.json())
      .then((data: BatchReport[]) => setReports(data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <PageTitle title="출석 리포트" description="출석 현황을 확인합니다." />
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title="출석 리포트"
        description={isReservist ? "나의 출석 현황을 확인합니다." : "전체 출석 현황을 확인합니다."}
      />

      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">배정된 차수가 없습니다.</div>
      ) : isReservist && session?.user?.id ? (
        <ReservistReportView reports={reports} userId={session.user.id} />
      ) : (
        <AdminReportView reports={reports} />
      )}
    </div>
  );
}
