"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";
import { BATCH_STATUS_LABELS } from "@/lib/constants";

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
}

interface Batch {
  id: string;
  name: string;
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
  trainings: Training[];
  users: { batchStatus?: string; batchReason?: string | null; batchExpectedConfirmAt?: string | null }[];
}

interface Meal {
  id: string;
  batchId: string;
  date: string;
  type: string;
  menuInfo: string | null;
  headcount: number;
}

interface CommutingRecord {
  id: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  note: string | null;
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

const MEAL_TYPE_LABELS: Record<string, string> = {
  BREAKFAST: "조식",
  LUNCH: "중식",
  DINNER: "석식",
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

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const startStr = startDate.split("T")[0];
  const endStr = endDate.split("T")[0];
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

type TabType = "attendance" | "training" | "meals" | "commuting" | "payment";

export default function ReservistBatchDetailPage() {
  const params = useParams();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("attendance");

  // 참석 신고 상태
  const [attendanceStatus, setAttendanceStatus] = useState<string>("PENDING");
  const [reason, setReason] = useState("");
  const [expectedConfirmAt, setExpectedConfirmAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // 식사 현황
  const [meals, setMeals] = useState<Meal[]>([]);
  const [mealsLoading, setMealsLoading] = useState(false);

  // 출퇴근 현황
  const [commutingRecords, setCommutingRecords] = useState<CommutingRecord[]>([]);
  const [commutingLoading, setCommutingLoading] = useState(false);

  const fetchBatch = useCallback(() => {
    setLoading(true);
    fetch(`/api/batches/${batchId}`)
      .then((r) => r.json())
      .then((data: Batch) => {
        setBatch(data);
        const me = data.users?.find((u) => u.batchStatus !== undefined);
        if (me) {
          setAttendanceStatus(me.batchStatus || "PENDING");
          setReason(me.batchReason || "");
          setExpectedConfirmAt(me.batchExpectedConfirmAt ? new Date(me.batchExpectedConfirmAt).toISOString().slice(0, 16) : "");
        }
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  // 식사 데이터 fetch
  const fetchMeals = useCallback(() => {
    setMealsLoading(true);
    fetch(`/api/meals?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data: Meal[]) => setMeals(data))
      .finally(() => setMealsLoading(false));
  }, [batchId]);

  useEffect(() => {
    if (tab === "meals") fetchMeals();
  }, [tab, fetchMeals]);

  // 출퇴근 데이터 fetch
  const fetchCommuting = useCallback(() => {
    if (!batch) return;
    setCommutingLoading(true);
    const dates = getDateRange(batch.startDate, batch.endDate);
    Promise.all(dates.map((date) => fetch(`/api/commuting?date=${date}`).then((r) => r.json())))
      .then((results) => {
        const all: CommutingRecord[] = results.flat();
        setCommutingRecords(all);
      })
      .finally(() => setCommutingLoading(false));
  }, [batch]);

  useEffect(() => {
    if (tab === "commuting" && batch) fetchCommuting();
  }, [tab, batch, fetchCommuting]);

  const handleSaveAttendance = async () => {
    setSaving(true);
    setError("");

    const body: Record<string, string | undefined> = { status: attendanceStatus };
    if (attendanceStatus === "ABSENT") body.reason = reason || undefined;
    if (attendanceStatus === "PENDING") body.expectedConfirmAt = expectedConfirmAt || undefined;

    try {
      const res = await fetch(`/api/batches/${batchId}/self-attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !batch) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const grouped = groupByDate(batch.trainings || []);

  // 식사 데이터를 날짜별로 그룹핑
  const mealsByDate: Record<string, Meal[]> = {};
  for (const m of meals) {
    const key = new Date(m.date).toISOString().slice(0, 10);
    if (!mealsByDate[key]) mealsByDate[key] = [];
    mealsByDate[key].push(m);
  }
  const mealDates = Object.entries(mealsByDate).sort(([a], [b]) => a.localeCompare(b));

  const tabs: { key: TabType; label: string }[] = [
    { key: "attendance", label: "참석신고" },
    { key: "training", label: "훈련계획" },
    { key: "meals", label: "식사현황" },
    { key: "commuting", label: "출퇴근" },
    { key: "payment", label: "훈련비" },
  ];

  return (
    <div>
      <PageTitle
        title={batch.name}
        description={
          `${batch.startDate.split("T")[0] === batch.endDate.split("T")[0]
            ? new Date(batch.startDate).toLocaleDateString("ko-KR")
            : `${new Date(batch.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(batch.endDate).toLocaleDateString("ko-KR")}`
          }${batch.location ? ` | ${batch.location}` : ""}`
        }
        actions={
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[batch.status] || "bg-gray-100"}`}>
            {BATCH_STATUS_LABELS[batch.status] || batch.status}
          </span>
        }
      />

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.key ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ 1. 참석신고 탭 ═══ */}
      {tab === "attendance" && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">참석 가능 현황</h3>

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

      {/* ═══ 2. 훈련계획 탭 ═══ */}
      {tab === "training" && (
        <>
          {(batch.trainings || []).length === 0 ? (
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
        </>
      )}

      {/* ═══ 3. 식사현황 탭 ═══ */}
      {tab === "meals" && (
        <>
          {mealsLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : meals.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              등록된 식사 정보가 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {mealDates.map(([dateKey, dayMeals]) => (
                <div key={dateKey}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2 px-1">
                    {formatDate(dayMeals[0].date)}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {["BREAKFAST", "LUNCH", "DINNER"].map((mealType) => {
                      const meal = dayMeals.find((m) => m.type === mealType);
                      return (
                        <div
                          key={mealType}
                          className={`rounded-xl border p-3 ${meal ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}
                        >
                          <p className="text-xs font-medium text-gray-500 mb-1">{MEAL_TYPE_LABELS[mealType]}</p>
                          {meal ? (
                            <>
                              <p className="text-sm text-gray-800">{meal.menuInfo || "-"}</p>
                              <p className="text-xs text-gray-400 mt-1">{meal.headcount}명</p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">미등록</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ 4. 출퇴근 탭 (보기 모드) ═══ */}
      {tab === "commuting" && (
        <>
          {commutingLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : commutingRecords.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              출퇴근 기록이 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {commutingRecords
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((rec) => (
                  <div key={rec.id} className="bg-white rounded-xl border p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      {formatDate(rec.date)}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">출근</p>
                        <p className={`text-sm font-medium ${rec.checkInAt ? "text-green-700" : "text-gray-400"}`}>
                          {formatTime(rec.checkInAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">퇴근</p>
                        <p className={`text-sm font-medium ${rec.checkOutAt ? "text-orange-700" : "text-gray-400"}`}>
                          {formatTime(rec.checkOutAt)}
                        </p>
                      </div>
                    </div>
                    {rec.note && (
                      <p className="text-xs text-gray-400 mt-2">비고: {rec.note}</p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {/* ═══ 5. 훈련비 탭 ═══ */}
      {tab === "payment" && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">훈련비</h3>
          <p className="text-sm text-gray-500 mb-4">해당 차수의 훈련비 상세 내역을 확인합니다.</p>
          <Link
            href={`/payments/${batchId}`}
            className="inline-block px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            훈련비 상세 보기
          </Link>
        </div>
      )}
    </div>
  );
}
