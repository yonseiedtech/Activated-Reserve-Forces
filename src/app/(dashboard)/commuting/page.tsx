"use client";

import { useEffect, useState, useCallback } from "react";
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
  summary: BatchSummary;
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
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {ADMIN_TABS.map((t) => (
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
// 예비역(훈련 대상자)용 뷰
// ═══════════════════════════════════════════

interface CommutingData {
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
}

interface TrainingDetail {
  trainingId: string;
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  status: "PRESENT" | "ABSENT" | "PENDING" | "NONE";
  // 출퇴근 기반 세부 분류
  detail: "정상이수" | "지연출근" | "조기퇴근" | "불참" | "미정" | "미기록";
}

type FilterTab = "all" | "present" | "absent";

function ReservistReportView({ reports, userId }: { reports: BatchReport[]; userId: string }) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [trainingDetails, setTrainingDetails] = useState<TrainingDetail[]>([]);
  const [commutingData, setCommutingData] = useState<CommutingData[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // 자동으로 첫 번째 차수 선택
  useEffect(() => {
    if (reports.length > 0 && !selectedBatchId) {
      setSelectedBatchId(reports[0].batchId);
    }
  }, [reports, selectedBatchId]);

  // 선택된 차수의 훈련별 출석 + 출퇴근 데이터 로드
  const fetchDetails = useCallback(async () => {
    if (!selectedBatchId) return;
    setDetailLoading(true);

    try {
      // 배치 상세 (훈련 목록 + 내 출석 정보)
      const batchRes = await fetch(`/api/batches/${selectedBatchId}`);
      const batchData = await batchRes.json();
      const trainings = batchData.trainings || [];

      // 출퇴근 기록 가져오기 (예비역은 자기 기록만 반환)
      const report = reports.find((r) => r.batchId === selectedBatchId);
      if (!report) { setDetailLoading(false); return; }

      const startStr = report.startDate.split("T")[0];
      const endStr = report.endDate.split("T")[0];
      const [sy, sm, sd] = startStr.split("-").map(Number);
      const [ey, em, ed] = endStr.split("-").map(Number);
      const dates: string[] = [];
      const cur = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
      const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
      while (cur <= end) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
        const d = String(cur.getUTCDate()).padStart(2, "0");
        dates.push(`${y}-${m}-${d}`);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      const commResults = await Promise.all(
        dates.map((date) => fetch(`/api/commuting?date=${date}`).then((r) => r.json()))
      );
      const allComm: CommutingData[] = commResults.flat();
      setCommutingData(allComm);

      // 훈련별 세부 분류 계산
      const details: TrainingDetail[] = trainings.map((t: { id: string; title: string; date: string; startTime: string | null; endTime: string | null; attendances?: { userId: string; status: string }[] }) => {
        const myAtt = t.attendances?.find((a: { userId: string }) => a.userId === userId);
        const status = myAtt ? myAtt.status as "PRESENT" | "ABSENT" | "PENDING" : "NONE";

        const tDateStr = new Date(t.date).toISOString().slice(0, 10);
        const comm = allComm.find((c) => new Date(c.date).toISOString().slice(0, 10) === tDateStr);

        let detail: TrainingDetail["detail"] = "미기록";

        if (status === "ABSENT") {
          detail = "불참";
        } else if (status === "PENDING") {
          detail = "미정";
        } else if (status === "PRESENT") {
          if (!comm || (!comm.checkInAt && !comm.checkOutAt)) {
            detail = "정상이수"; // 출퇴근 기록 없으면 정상으로 간주
          } else {
            const isLate = comm.checkInAt && t.startTime
              ? comm.checkInAt > `${tDateStr}T${t.startTime}:00`
              : false;
            const isEarly = comm.checkOutAt && t.endTime
              ? comm.checkOutAt < `${tDateStr}T${t.endTime}:00`
              : false;
            if (isLate) detail = "지연출근";
            else if (isEarly) detail = "조기퇴근";
            else detail = "정상이수";
          }
        }

        return { trainingId: t.id, title: t.title, date: t.date, startTime: t.startTime, endTime: t.endTime, status, detail };
      });

      setTrainingDetails(details);
    } catch {
      setTrainingDetails([]);
    }
    setDetailLoading(false);
  }, [selectedBatchId, userId, reports]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const selectedReport = reports.find((r) => r.batchId === selectedBatchId);
  const myStat = selectedReport?.byUser.find((u) => u.userId === userId);

  // 필터 적용
  const filteredDetails = trainingDetails.filter((d) => {
    if (filter === "all") return true;
    if (filter === "present") return d.status === "PRESENT";
    if (filter === "absent") return d.status === "ABSENT";
    return true;
  });

  const presentCount = trainingDetails.filter((d) => d.status === "PRESENT").length;
  const absentCount = trainingDetails.filter((d) => d.status === "ABSENT").length;
  const normalCount = trainingDetails.filter((d) => d.detail === "정상이수").length;
  const lateCount = trainingDetails.filter((d) => d.detail === "지연출근").length;
  const earlyCount = trainingDetails.filter((d) => d.detail === "조기퇴근").length;

  const DETAIL_COLORS: Record<string, string> = {
    "정상이수": "bg-green-100 text-green-700",
    "지연출근": "bg-yellow-100 text-yellow-700",
    "조기퇴근": "bg-orange-100 text-orange-700",
    "불참": "bg-red-100 text-red-700",
    "미정": "bg-gray-100 text-gray-600",
    "미기록": "bg-gray-50 text-gray-400",
  };

  if (reports.length === 0) {
    return <div className="text-center py-16 text-gray-400">배정된 차수가 없습니다.</div>;
  }

  return (
    <div className="space-y-4">
      {/* 차수 리스트 */}
      <div className="space-y-2">
        {reports.map((r) => {
          const stat = r.byUser.find((u) => u.userId === userId);
          const isSelected = r.batchId === selectedBatchId;
          return (
            <button
              key={r.batchId}
              onClick={() => setSelectedBatchId(r.batchId)}
              className={`w-full text-left bg-white rounded-xl border p-4 transition-all ${
                isSelected ? "border-blue-400 shadow-sm ring-1 ring-blue-200" : "hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{r.batchName}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || "bg-gray-100"}`}>
                      {STATUS_LABELS[r.status] || r.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.startDate.split("T")[0]} ~ {r.endDate.split("T")[0]} | {r.totalTrainings}개 훈련
                  </p>
                </div>
                {stat && <RateBadge rate={stat.rate} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* 선택된 차수 상세 */}
      {selectedReport && myStat && (
        <>
          {/* 종합 요약 카드 */}
          <div className="bg-white rounded-xl border p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">참석 현황 종합</h3>
              <RateBadge rate={myStat.rate} />
            </div>
            <RateBar rate={myStat.rate} />
            <div className="grid grid-cols-3 gap-3 text-center mt-4">
              <div>
                <p className="text-xs text-gray-500">참석</p>
                <p className="text-lg font-bold text-green-600">{myStat.present}</p>
                <div className="flex justify-center gap-1 mt-1">
                  {normalCount > 0 && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">정상 {normalCount}</span>}
                  {lateCount > 0 && <span className="text-[10px] bg-yellow-50 text-yellow-600 px-1.5 py-0.5 rounded">지연 {lateCount}</span>}
                  {earlyCount > 0 && <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">조퇴 {earlyCount}</span>}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">불참</p>
                <p className="text-lg font-bold text-red-600">{myStat.absent}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">미정</p>
                <p className="text-lg font-bold text-gray-500">{myStat.pending}</p>
              </div>
            </div>
          </div>

          {/* ALL / 참석 / 불참 필터 탭 */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setFilter("all")}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                filter === "all" ? "bg-white shadow text-blue-600" : "text-gray-600"
              }`}
            >
              전체 ({trainingDetails.length})
            </button>
            <button
              onClick={() => setFilter("present")}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                filter === "present" ? "bg-white shadow text-green-600" : "text-gray-600"
              }`}
            >
              참석 ({presentCount})
            </button>
            <button
              onClick={() => setFilter("absent")}
              className={`flex-1 py-2 rounded-md text-xs font-medium transition-colors ${
                filter === "absent" ? "bg-white shadow text-red-600" : "text-gray-600"
              }`}
            >
              불참 ({absentCount})
            </button>
          </div>

          {/* 훈련별 목록 */}
          {detailLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDetails.length === 0 ? (
                <div className="text-center py-10 text-gray-400">해당하는 항목이 없습니다.</div>
              ) : (
                filteredDetails.map((d) => {
                  const dt = new Date(d.date);
                  const days = ["일", "월", "화", "수", "목", "금", "토"];
                  const dateStr = `${dt.getMonth() + 1}/${dt.getDate()} (${days[dt.getDay()]})`;
                  return (
                    <div key={d.trainingId} className="bg-white rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-500">{dateStr}</span>
                            {d.startTime && d.endTime && (
                              <span className="text-xs text-gray-400">{d.startTime}~{d.endTime}</span>
                            )}
                          </div>
                          <h4 className="font-medium text-sm text-gray-900">{d.title}</h4>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${DETAIL_COLORS[d.detail]}`}>
                          {d.detail}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </>
      )}

      {selectedReport && !myStat && (
        <div className="text-center py-10 text-gray-400">출석 데이터가 없습니다.</div>
      )}
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
