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

interface TypeStat {
  type: string;
  present: number;
  absent: number;
  pending: number;
  total: number;
  count: number;
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
  byType: TypeStat[];
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

type Tab = "batch" | "type" | "person";

const TABS: { key: Tab; label: string }[] = [
  { key: "batch", label: "차수별 출석률" },
  { key: "type", label: "훈련유형별 출석률" },
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

export default function AttendanceReportPage() {
  const { data: session } = useSession();
  const [reports, setReports] = useState<BatchReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("batch");
  const [selectedBatchId, setSelectedBatchId] = useState("");

  useEffect(() => {
    fetch("/api/attendance-report")
      .then((r) => r.json())
      .then((data: BatchReport[]) => {
        setReports(data);
        const active = data.find((b) => b.status === "ACTIVE");
        setSelectedBatchId(active?.batchId || data[0]?.batchId || "");
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const report = reports.find((r) => r.batchId === selectedBatchId);

  // 전체 차수 종합 통계
  const totalSummary = {
    present: reports.reduce((s, r) => s + r.summary.present, 0),
    total: reports.reduce((s, r) => s + r.summary.total, 0),
    batches: reports.length,
    users: reports.reduce((s, r) => s + r.totalUsers, 0),
    trainings: reports.reduce((s, r) => s + r.totalTrainings, 0),
  };
  totalSummary.present; // used below
  const totalRate = totalSummary.total > 0 ? Math.round((totalSummary.present / totalSummary.total) * 100) : 0;

  if (loading) {
    return (
      <div>
        <PageTitle title="출석 리포트" description="차수별 출석 현황을 확인합니다." />
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="출석 리포트" description="차수별 출석 현황을 확인합니다." />

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
              {/* 총 출석률 요약 */}
              <div className="bg-white rounded-xl border p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">전체 종합</h3>
                  <RateBadge rate={totalRate} />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-xs text-gray-500">총 차수</p>
                    <p className="text-lg font-bold text-gray-800">{totalSummary.batches}개</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">총 훈련 과목</p>
                    <p className="text-lg font-bold text-gray-800">{totalSummary.trainings}개</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">총 참석</p>
                    <p className="text-lg font-bold text-gray-800">
                      <span className="text-green-600">{totalSummary.present}</span>
                      <span className="text-gray-400 text-sm">/{totalSummary.total}</span>
                    </p>
                  </div>
                </div>
                <RateBar rate={totalRate} />
              </div>

              {/* 차수별 카드 */}
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

          {/* ─── 탭 2: 훈련유형별 출석률 ─── */}
          {tab === "type" && (
            <div className="space-y-6">
              {/* 차수 선택 */}
              <div className="flex gap-2 flex-wrap">
                {reports.map((r) => (
                  <button
                    key={r.batchId}
                    onClick={() => setSelectedBatchId(r.batchId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedBatchId === r.batchId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {r.batchName}
                  </button>
                ))}
              </div>

              {report && (
                <>
                  {/* 평일 / 주말 */}
                  {report.byDayType.length > 0 && (
                    <div className="bg-white rounded-xl border overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="font-semibold text-sm">평일 / 주말 출석률</h3>
                      </div>
                      <div className="divide-y">
                        {report.byDayType.map((dt) => (
                          <div key={dt.dayType} className="px-4 py-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-semibold text-sm">{dt.label}</span>
                                <span className="ml-2 text-xs text-gray-500">{dt.count}개 과목</span>
                              </div>
                              <RateBadge rate={dt.rate} />
                            </div>
                            <RateBar rate={dt.rate} />
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>참석 <span className="text-green-600 font-medium">{dt.present}</span></span>
                              <span>불참 <span className="text-red-600 font-medium">{dt.absent}</span></span>
                              <span>미정 <span className="font-medium">{dt.pending}</span></span>
                              <span>전체 <span className="font-medium">{dt.total}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 훈련유형별 */}
                  {report.byType.length > 0 && (
                    <div className="bg-white rounded-xl border overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b">
                        <h3 className="font-semibold text-sm">훈련유형별 출석률</h3>
                      </div>
                      <div className="divide-y">
                        {report.byType.map((t) => (
                          <div key={t.type} className="px-4 py-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-semibold text-sm">{t.type}</span>
                                <span className="ml-2 text-xs text-gray-500">{t.count}개 과목</span>
                              </div>
                              <RateBadge rate={t.rate} />
                            </div>
                            <RateBar rate={t.rate} />
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>참석 <span className="text-green-600 font-medium">{t.present}</span></span>
                              <span>불참 <span className="text-red-600 font-medium">{t.absent}</span></span>
                              <span>미정 <span className="font-medium">{t.pending}</span></span>
                              <span>전체 <span className="font-medium">{t.total}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.byDayType.length === 0 && report.byType.length === 0 && (
                    <div className="text-center py-12 text-gray-400">출석 데이터가 없습니다.</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── 탭 3: 인원별 출석률 ─── */}
          {tab === "person" && (
            <div className="space-y-6">
              {/* 차수 선택 */}
              <div className="flex gap-2 flex-wrap">
                {reports.map((r) => (
                  <button
                    key={r.batchId}
                    onClick={() => setSelectedBatchId(r.batchId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedBatchId === r.batchId
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {r.batchName}
                  </button>
                ))}
              </div>

              {report && (
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">인원별 출석률</h3>
                    <span className="text-xs text-gray-500">{report.byUser.length}명</span>
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
                        {report.byUser.length === 0 ? (
                          <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">출석 데이터가 없습니다.</td></tr>
                        ) : (
                          [...report.byUser]
                            .sort((a, b) => b.rate - a.rate)
                            .map((u, i) => (
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
                    {report.byUser.length === 0 ? (
                      <p className="px-4 py-8 text-center text-gray-400">출석 데이터가 없습니다.</p>
                    ) : (
                      [...report.byUser]
                        .sort((a, b) => b.rate - a.rate)
                        .map((u, i) => (
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
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
