"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
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

interface BatchUserSelf {
  status: string;
  reason: string | null;
  expectedConfirmAt: string | null;
}

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
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

  // 차수 참석 신고 상태
  const [batchAttendance, setBatchAttendance] = useState<BatchUserSelf | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<string>("PENDING");
  const [reason, setReason] = useState("");
  const [expectedConfirmAt, setExpectedConfirmAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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
        // 본인의 참석 상태 찾기 (users 배열에서 본인 데이터)
        const me = data.users?.find((u: { batchStatus?: string }) => u.batchStatus !== undefined);
        if (me) {
          setBatchAttendance({ status: me.batchStatus, reason: me.batchReason, expectedConfirmAt: me.batchExpectedConfirmAt });
          setAttendanceStatus(me.batchStatus || "PENDING");
          setReason(me.batchReason || "");
          setExpectedConfirmAt(me.batchExpectedConfirmAt ? new Date(me.batchExpectedConfirmAt).toISOString().slice(0, 16) : "");
        } else {
          setBatchAttendance(null);
          setAttendanceStatus("PENDING");
          setReason("");
          setExpectedConfirmAt("");
        }
      })
      .finally(() => setDetailLoading(false));
  }, [selectedBatchId]);

  const handleSaveAttendance = async () => {
    setSaving(true);
    setError("");

    const body: Record<string, string | undefined> = { status: attendanceStatus };
    if (attendanceStatus === "ABSENT") body.reason = reason || undefined;
    if (attendanceStatus === "PENDING") body.expectedConfirmAt = expectedConfirmAt || undefined;

    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/self-attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다.");
      } else {
        setSaved(true);
        setBatchAttendance({ status: attendanceStatus, reason: reason || null, expectedConfirmAt: expectedConfirmAt || null });
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

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

      {/* 차수 참석 신고 폼 */}
      {!detailLoading && selectedBatch && (
        <div className="bg-white rounded-xl border p-5 mb-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">차수 참석 신고</h3>

          {/* 3개 상태 버튼 */}
          <div className="flex gap-2">
            <button
              onClick={() => { setAttendanceStatus("PRESENT"); setSaved(false); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                attendanceStatus === "PRESENT"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              참석
            </button>
            <button
              onClick={() => { setAttendanceStatus("ABSENT"); setSaved(false); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                attendanceStatus === "ABSENT"
                  ? "bg-red-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              불참
            </button>
            <button
              onClick={() => { setAttendanceStatus("PENDING"); setSaved(false); setError(""); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                attendanceStatus === "PENDING"
                  ? "bg-gray-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              미정
            </button>
          </div>

          {/* 불참 - 사유 입력 */}
          {attendanceStatus === "ABSENT" && (
            <div>
              <label className="text-xs font-medium text-gray-600">불참 사유</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="불참 사유를 입력해주세요."
                rows={2}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
              />
            </div>
          )}

          {/* 미정 - 확정 예정 시점 */}
          {attendanceStatus === "PENDING" && (
            <div>
              <label className="text-xs font-medium text-gray-600">확정 예정 시점</label>
              <input
                type="datetime-local"
                value={expectedConfirmAt}
                onChange={(e) => setExpectedConfirmAt(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-gray-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                참석 여부가 확정되지 않은 경우, 확정 예정 일시를 입력하세요.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSaveAttendance}
            disabled={saving}
            className={`w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
              saved ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
            } disabled:opacity-50`}
          >
            {saving ? "저장 중..." : saved ? "저장 완료!" : "저장"}
          </button>
        </div>
      )}

      {/* 훈련 과목 목록 (읽기 전용) */}
      {detailLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : trainings.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          등록된 훈련 과목이 없습니다.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dayTrainings]) => (
            <div key={dateKey}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">
                {formatDate(dayTrainings[0].date)}
              </h3>
              <div className="space-y-3">
                {dayTrainings.map((t) => (
                  <div key={t.id} className="bg-white rounded-xl border p-4">
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
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
