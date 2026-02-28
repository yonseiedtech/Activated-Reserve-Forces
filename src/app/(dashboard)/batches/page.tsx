"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";
import { BATCH_STATUS_LABELS, ATTENDANCE_STATUS_LABELS } from "@/lib/constants";

interface Batch {
  id: string;
  name: string;
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
  myAttendanceStatus?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

const ATTENDANCE_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  ABSENT: "bg-red-100 text-red-700",
  PENDING: "bg-gray-100 text-gray-600",
};

type FilterType = "ALL" | "PLANNED" | "ACTIVE" | "COMPLETED";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
function formatDateWithDay(iso: string) {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  return `${yy}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${DAYS[d.getDay()]})`;
}

export default function ReservistBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then(setBatches)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const filtered = filter === "ALL" ? batches : batches.filter((b) => b.status === filter);

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: "ALL", label: "전체" },
    { key: "PLANNED", label: "예정" },
    { key: "ACTIVE", label: "진행" },
    { key: "COMPLETED", label: "완료" },
  ];

  // 상태별 카운트
  const counts: Record<string, number> = { ALL: batches.length };
  for (const b of batches) {
    counts[b.status] = (counts[b.status] || 0) + 1;
  }

  return (
    <div>
      <PageTitle title="차수현황" />

      {/* 필터 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
        {filterTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              filter === t.key ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
            {(counts[t.key] || 0) > 0 && (
              <span className="ml-1 text-xs text-gray-400">({counts[t.key]})</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          {filter === "ALL" ? "배정된 훈련차수가 없습니다." : `${filterTabs.find((t) => t.key === filter)?.label} 상태의 차수가 없습니다.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Link
              key={b.id}
              href={`/batches/${b.id}`}
              className="block bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{b.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {b.startDate.split("T")[0] === b.endDate.split("T")[0]
                      ? formatDateWithDay(b.startDate)
                      : `${formatDateWithDay(b.startDate)} ~ ${formatDateWithDay(b.endDate)}`
                    }
                    {b.location && ` | ${b.location}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {b.myAttendanceStatus && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ATTENDANCE_COLORS[b.myAttendanceStatus] || "bg-gray-100 text-gray-600"}`}>
                      {ATTENDANCE_STATUS_LABELS[b.myAttendanceStatus] || b.myAttendanceStatus}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
