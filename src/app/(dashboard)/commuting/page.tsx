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

function RateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? "bg-green-100 text-green-700" :
    rate >= 50 ? "bg-yellow-100 text-yellow-700" :
    "bg-red-100 text-red-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{rate}%</span>;
}

function RateBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? "bg-green-500" : rate >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
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
  const [selectedBatchId, setSelectedBatchId] = useState("");

  useEffect(() => {
    fetch("/api/attendance-report")
      .then((r) => r.json())
      .then((data: BatchReport[]) => {
        setReports(data);
        // 기본 선택: ACTIVE > 첫 번째
        const active = data.find((b) => b.status === "ACTIVE");
        setSelectedBatchId(active?.batchId || data[0]?.batchId || "");
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  const report = reports.find((r) => r.batchId === selectedBatchId);

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
          {/* 차수 선택 */}
          <div className="mb-6">
            <div className="flex gap-2 flex-wrap">
              {reports.map((r) => (
                <button
                  key={r.batchId}
                  onClick={() => setSelectedBatchId(r.batchId)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedBatchId === r.batchId
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {r.batchName}
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${
                    selectedBatchId === r.batchId
                      ? "bg-blue-500 text-white"
                      : STATUS_COLORS[r.status] || "bg-gray-100"
                  }`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {report && (
            <div className="space-y-6">
              {/* 종합 요약 카드 */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">전체 출석률</p>
                  <p className={`text-2xl font-bold ${
                    report.summary.rate >= 80 ? "text-green-600" :
                    report.summary.rate >= 50 ? "text-yellow-600" : "text-red-600"
                  }`}>{report.summary.rate}%</p>
                </div>
                <div className="bg-white rounded-xl border p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">총 대상 인원</p>
                  <p className="text-2xl font-bold text-gray-800">{report.totalUsers}명</p>
                </div>
                <div className="bg-white rounded-xl border p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">훈련 과목 수</p>
                  <p className="text-2xl font-bold text-gray-800">{report.totalTrainings}개</p>
                </div>
                <div className="bg-white rounded-xl border p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">참석 / 전체</p>
                  <p className="text-2xl font-bold text-gray-800">
                    <span className="text-green-600">{report.summary.present}</span>
                    <span className="text-gray-400 text-lg">/{report.summary.total}</span>
                  </p>
                </div>
              </div>

              {/* 평일/주말 출석률 + 훈련유형별 출석률 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 평일/주말 */}
                {report.byDayType.length > 0 && (
                  <div className="bg-white rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b">
                      <h3 className="font-semibold text-sm">평일 / 주말 출석률</h3>
                    </div>
                    <div className="p-4 space-y-4">
                      {report.byDayType.map((dt) => (
                        <div key={dt.dayType}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{dt.label}</span>
                            <span className="text-xs text-gray-500">{dt.count}개 과목 · 참석 {dt.present}/{dt.total}</span>
                          </div>
                          <RateBar rate={dt.rate} />
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
                    <div className="p-4 space-y-4">
                      {report.byType.map((t) => (
                        <div key={t.type}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium">{t.type}</span>
                            <span className="text-xs text-gray-500">{t.count}개 · 참석 {t.present}/{t.total}</span>
                          </div>
                          <RateBar rate={t.rate} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 인원별 출석률 */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-semibold text-sm">인원별 출석률</h3>
                </div>

                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs border-b">
                        <th className="px-4 py-2 font-medium">이름</th>
                        <th className="px-4 py-2 font-medium text-center">참석</th>
                        <th className="px-4 py-2 font-medium text-center">불참</th>
                        <th className="px-4 py-2 font-medium text-center">미정</th>
                        <th className="px-4 py-2 font-medium w-40">출석률</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {report.byUser.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">출석 데이터가 없습니다.</td></tr>
                      ) : (
                        report.byUser.map((u) => (
                          <tr key={u.userId} className="hover:bg-gray-50">
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
                    <p className="px-4 py-6 text-center text-gray-400">출석 데이터가 없습니다.</p>
                  ) : (
                    report.byUser.map((u) => (
                      <div key={u.userId} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{u.name}</span>
                            {u.rank && <span className="ml-1 text-xs text-gray-500">{u.rank}</span>}
                          </div>
                          <RateBadge rate={u.rate} />
                        </div>
                        <div className="flex gap-3 text-xs text-gray-500 mb-2">
                          <span>참석 <span className="text-green-600 font-medium">{u.present}</span></span>
                          <span>불참 <span className="text-red-600 font-medium">{u.absent}</span></span>
                          <span>미정 <span className="font-medium">{u.pending}</span></span>
                        </div>
                        <RateBar rate={u.rate} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
