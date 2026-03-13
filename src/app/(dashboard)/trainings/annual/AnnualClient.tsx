"use client";

import { useState } from "react";
import Link from "next/link";

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

type BatchData = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  requiredHours: number | null;
  userCount: number;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  months: number[]; // 이 차수가 걸치는 월 인덱스 (0~11)
  trainings: {
    id: string;
    title: string;
    type: string;
    date: string;
    startTime: string | null;
    endTime: string | null;
  }[];
};

type MonthStat = {
  batchCount: number;
  trainingCount: number;
};

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    PLANNED: { label: "예정", cls: "bg-gray-100 text-gray-600" },
    ACTIVE: { label: "진행중", cls: "bg-green-100 text-green-700" },
    COMPLETED: { label: "완료", cls: "bg-blue-100 text-blue-700" },
  };
  const s = map[status] || map.PLANNED;
  return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
}

export default function AnnualClient({
  year,
  batches,
  monthStats,
}: {
  year: number;
  batches: BatchData[];
  monthStats: MonthStat[];
}) {
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() : -1;

  // 상태별 카운트
  const totalBatches = batches.length;
  const completedBatches = batches.filter((b) => b.status === "COMPLETED").length;
  const activeBatches = batches.filter((b) => b.status === "ACTIVE").length;
  const plannedBatches = batches.filter((b) => b.status === "PLANNED").length;

  // 선택된 월에 해당하는 차수 필터링
  const filteredBatches = selectedMonth !== null
    ? batches.filter((b) => b.months.includes(selectedMonth))
    : batches;

  return (
    <>
      {/* 연간 요약 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-blue-600">{totalBatches}</p>
          <p className="text-xs text-gray-500 mt-1">총 차수</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{completedBatches}</p>
          <p className="text-xs text-gray-500 mt-1">완료</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{activeBatches}</p>
          <p className="text-xs text-gray-500 mt-1">진행중</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <p className="text-3xl font-bold text-gray-400">{plannedBatches}</p>
          <p className="text-xs text-gray-500 mt-1">예정</p>
        </div>
      </div>

      {/* 월별 타임라인 */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">월별 훈련 현황</h2>
          {selectedMonth !== null && (
            <button
              onClick={() => setSelectedMonth(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              전체 보기
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-12 min-w-[700px]">
            {monthStats.map((stat, i) => {
              const isCurrentMonth = i === currentMonth;
              const isSelected = selectedMonth === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedMonth(selectedMonth === i ? null : i)}
                  className={`p-3 border-r last:border-r-0 text-center transition-colors ${
                    isSelected
                      ? "bg-blue-100 border-b-2 border-b-blue-600"
                      : isCurrentMonth
                        ? "bg-blue-50 border-b-2 border-b-blue-500"
                        : "hover:bg-gray-50"
                  } ${stat.batchCount > 0 ? "cursor-pointer" : "opacity-50 cursor-default"}`}
                  disabled={stat.batchCount === 0}
                >
                  <p className={`text-xs font-bold mb-2 ${
                    isSelected ? "text-blue-800" : isCurrentMonth ? "text-blue-700" : "text-gray-600"
                  }`}>
                    {MONTH_NAMES[i]}
                  </p>
                  {stat.batchCount > 0 ? (
                    <>
                      <p className="text-lg font-bold text-gray-800">{stat.batchCount}</p>
                      <p className="text-xs text-gray-400">차수</p>
                      {stat.trainingCount > 0 && (
                        <p className="text-xs text-green-600 mt-1">{stat.trainingCount}개 과목</p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-300 mt-2">-</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 선택된 월 표시 */}
      {selectedMonth !== null && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-700">{MONTH_NAMES[selectedMonth]}</span>
          <span className="text-sm text-gray-500">차수 {filteredBatches.length}개</span>
        </div>
      )}

      {/* 차수별 상세 */}
      {filteredBatches.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">
            {selectedMonth !== null
              ? `${MONTH_NAMES[selectedMonth]}에 해당하는 차수가 없습니다.`
              : `${year}년에 등록된 훈련 차수가 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBatches.map((batch) => {
            const days = Math.ceil(
              (new Date(batch.endDate).getTime() - new Date(batch.startDate).getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;

            // 날짜별 훈련 그룹핑
            const dateGroups: Record<string, typeof batch.trainings> = {};
            for (const t of batch.trainings) {
              const dk = new Date(t.date).toISOString().split("T")[0];
              if (!dateGroups[dk]) dateGroups[dk] = [];
              dateGroups[dk].push(t);
            }

            return (
              <div key={batch.id} className="bg-white rounded-xl border overflow-hidden">
                <div className={`px-4 py-3 border-b flex items-center justify-between ${
                  batch.status === "ACTIVE" ? "bg-green-50" : batch.status === "COMPLETED" ? "bg-gray-50" : "bg-blue-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/batches/${batch.id}`} className="font-bold text-gray-800 hover:text-blue-600">
                      {batch.name}
                    </Link>
                    {statusBadge(batch.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatDate(batch.startDate)} ~ {formatDate(batch.endDate)} ({days}일)</span>
                    <span>{batch.userCount}명</span>
                    {batch.requiredHours && <span>{batch.requiredHours}시간</span>}
                    {batch.location && <span>{batch.location}</span>}
                  </div>
                </div>

                {batch.trainings.length > 0 ? (
                  <div className="divide-y">
                    {Object.entries(dateGroups).sort().map(([dateKey, trainings]) => {
                      const d = new Date(dateKey + "T00:00:00");
                      const dayLabel = d.toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" });
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div key={dateKey} className="px-4 py-2">
                          <div className="flex items-start gap-3">
                            <span className={`text-xs font-medium min-w-[90px] pt-0.5 ${isWeekend ? "text-red-500" : "text-gray-500"}`}>
                              {dayLabel}
                            </span>
                            <div className="flex-1 flex flex-wrap gap-1.5">
                              {trainings.map((t) => (
                                <span
                                  key={t.id}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded text-xs"
                                >
                                  <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">
                                    {t.type}
                                  </span>
                                  <span className="text-gray-700">{t.title}</span>
                                  {t.startTime && t.endTime && (
                                    <span className="text-gray-400 font-mono">{t.startTime}~{t.endTime}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-xs text-gray-400 text-center">
                    등록된 훈련 과목이 없습니다.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
