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

interface DayTypeStat {
  dayType: string;
  label: string;
  present: number;
  absent: number;
  pending: number;
  total: number;
  count: number;
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
  summary: BatchSummary;
  byDayType: DayTypeStat[];
  byUser: UserStat[];
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

type Tab = "batch" | "daytype" | "person";

const TABS: { key: Tab; label: string }[] = [
  { key: "batch", label: "차수별 출석률" },
  { key: "daytype", label: "평일/주말 출석률" },
  { key: "person", label: "인원별 출석률" },
];

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

function DayTypeRow({ label, stat, badge }: { label: string; stat: DayTypeStat | null; badge?: string }) {
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
        <span>{stat.count}개 과목</span>
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

export default function AttendanceReportPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("batch");

  useEffect(() => {
    fetch("/api/attendance-report")
      .then((r) => r.json())
      .then((data: BatchReport[]) => setReports(data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  // 전체 종합 통계
  const totalPresent = reports.reduce((s, r) => s + r.summary.present, 0);
  const totalAtt = reports.reduce((s, r) => s + r.summary.total, 0);
  const totalRate = totalAtt > 0 ? Math.round((totalPresent / totalAtt) * 100) : 0;

  // 전체 종합 평일/주말
  const totalDayType = { weekday: { present: 0, absent: 0, pending: 0, total: 0, count: 0 }, weekend: { present: 0, absent: 0, pending: 0, total: 0, count: 0 } };
  for (const r of reports) {
    for (const dt of r.byDayType) {
      const key = dt.dayType as "weekday" | "weekend";
      if (totalDayType[key]) {
        totalDayType[key].present += dt.present;
        totalDayType[key].absent += dt.absent;
        totalDayType[key].pending += dt.pending;
        totalDayType[key].total += dt.total;
        totalDayType[key].count += dt.count;
      }
    }
  }
  const totalDayTypeData = {
    weekday: totalDayType.weekday.count > 0
      ? { ...totalDayType.weekday, dayType: "weekday", label: "평일", rate: Math.round((totalDayType.weekday.present / totalDayType.weekday.total) * 100) } as DayTypeStat
      : null,
    weekend: totalDayType.weekend.count > 0
      ? { ...totalDayType.weekend, dayType: "weekend", label: "주말", rate: Math.round((totalDayType.weekend.present / totalDayType.weekend.total) * 100) } as DayTypeStat
      : null,
  };

  // 전체 종합 인원별 (동일 인원을 차수 간 합산)
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
      <PageTitle title="출석 리포트" description="출석 현황을 확인합니다." />

      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-400">배정된 차수가 없습니다.</div>
      ) : (
        <>
          {/* 탭 네비게이션 */}
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 min-w-fit px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? "bg-white shadow text-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ─── 탭 1: 차수별 출석률 ─── */}
          {tab === "batch" && (
            <div className="space-y-6">
              {/* 전체 종합 */}
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

              {/* 개별 차수 카드 */}
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

          {/* ─── 탭 2: 평일/주말 출석률 ─── */}
          {tab === "daytype" && (
            <div className="space-y-8">
              {/* 평일 출석률 */}
              <div>
                <h2 className="text-base font-bold mb-3">평일 출석률</h2>
                <div className="space-y-3">
                  <DayTypeRow label="전체 종합" stat={totalDayTypeData.weekday} />
                  {reports.map((r) => (
                    <DayTypeRow
                      key={r.batchId}
                      label={r.batchName}
                      stat={r.byDayType.find((d) => d.dayType === "weekday") || null}
                      badge={STATUS_LABELS[r.status] || r.status}
                    />
                  ))}
                </div>
              </div>

              {/* 주말 출석률 */}
              <div>
                <h2 className="text-base font-bold mb-3">주말 출석률</h2>
                <div className="space-y-3">
                  <DayTypeRow label="전체 종합" stat={totalDayTypeData.weekend} />
                  {reports.map((r) => (
                    <DayTypeRow
                      key={r.batchId}
                      label={r.batchName}
                      stat={r.byDayType.find((d) => d.dayType === "weekend") || null}
                      badge={STATUS_LABELS[r.status] || r.status}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── 탭 3: 인원별 출석률 ─── */}
          {tab === "person" && (
            <div className="space-y-6">
              {/* 전체 종합 */}
              <UserTable users={totalUsers} label="전체 종합" count={totalUsers.length} />

              {/* 개별 차수별 */}
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
      )}
    </div>
  );
}
