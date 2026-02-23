"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
import SelfAttendanceForm from "@/components/attendance/SelfAttendanceForm";
import { BATCH_STATUS_LABELS } from "@/lib/constants";

interface Batch {
  id: string;
  name: string;
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
}

interface Attendance {
  id: string;
  status: string;
  reason: string | null;
  expectedConfirmAt: string | null;
  earlyLeaveTime: string | null;
}

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  attendances?: Attendance[];
}

const TYPE_COLORS: Record<string, string> = {
  사격: "bg-red-100 text-red-700",
  화생방: "bg-yellow-100 text-yellow-700",
  전술: "bg-green-100 text-green-700",
  체력: "bg-blue-100 text-blue-700",
  정신교육: "bg-purple-100 text-purple-700",
  기타: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}

function groupByDate(trainings: Training[]) {
  const groups: Record<string, Training[]> = {};
  for (const t of trainings) {
    const key = new Date(t.date).toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

export default function ReservistBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>("");
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then((data: Batch[]) => {
        setBatches(data);
        if (data.length > 0) {
          setSelectedBatchId(data[0].id);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBatchId) return;
    setDetailLoading(true);
    fetch(`/api/batches/${selectedBatchId}`)
      .then((r) => r.json())
      .then((data) => {
        setTrainings(data.trainings || []);
      })
      .finally(() => setDetailLoading(false));
  }, [selectedBatchId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div>
        <PageTitle title="훈련차수" />
        <div className="text-center py-20 text-gray-500">
          배정된 훈련차수가 없습니다.
        </div>
      </div>
    );
  }

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const grouped = groupByDate(trainings);

  return (
    <div>
      <PageTitle title="훈련차수" />

      {/* 차수 선택 */}
      {batches.length >= 2 ? (
        <div className="mb-4">
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="w-full px-4 py-2.5 border rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* 차수 정보 요약 */}
      {selectedBatch && (
        <div className="bg-white rounded-xl border p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{selectedBatch.name}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {new Date(selectedBatch.startDate).toLocaleDateString("ko-KR")} ~ {new Date(selectedBatch.endDate).toLocaleDateString("ko-KR")}
                {selectedBatch.location && ` | ${selectedBatch.location}`}
              </p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedBatch.status] || "bg-gray-100"}`}>
              {BATCH_STATUS_LABELS[selectedBatch.status] || selectedBatch.status}
            </span>
          </div>
        </div>
      )}

      {/* 훈련 목록 */}
      {detailLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : trainings.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          등록된 훈련이 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dayTrainings]) => (
            <div key={dateKey}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">
                {formatDate(dayTrainings[0].date)}
              </h3>
              <div className="space-y-3">
                {dayTrainings.map((t) => {
                  const att = t.attendances?.[0];
                  return (
                    <div key={t.id} className="bg-white rounded-xl border overflow-hidden">
                      {/* 훈련 정보 */}
                      <div className="p-4 border-b">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[t.type] || TYPE_COLORS["기타"]}`}>
                            {t.type}
                          </span>
                          <h4 className="font-semibold text-gray-900 text-sm">{t.title}</h4>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                          {t.startTime && t.endTime && (
                            <span>{t.startTime} ~ {t.endTime}</span>
                          )}
                          {t.location && <span>{t.location}</span>}
                        </div>
                      </div>
                      {/* 참석 폼 */}
                      <div className="p-4">
                        <SelfAttendanceForm
                          trainingId={t.id}
                          initialStatus={att?.status}
                          initialReason={att?.reason || ""}
                          initialExpectedConfirmAt={att?.expectedConfirmAt || ""}
                          initialEarlyLeaveTime={att?.earlyLeaveTime || ""}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
