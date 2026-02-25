"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";
import { BATCH_STATUS_LABELS } from "@/lib/constants";

interface TrainingAttendance {
  id: string;
  status: string;
}

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  attendances?: TrainingAttendance[];
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

interface Survey {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  _count: { responses: number };
}

type TabType = "attendance" | "training" | "meals" | "commuting" | "payment" | "survey";

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

  // 석식 신청
  interface DinnerReq {
    id: string;
    date: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }
  const [dinnerRequests, setDinnerRequests] = useState<DinnerReq[]>([]);
  const [dinnerDeadlines, setDinnerDeadlines] = useState<{ applyDeadline: string; cancelDeadline: string } | null>(null);
  const [dinnerSubmitting, setDinnerSubmitting] = useState(false);

  // 출퇴근 현황
  const [commutingRecords, setCommutingRecords] = useState<CommutingRecord[]>([]);
  const [commutingLoading, setCommutingLoading] = useState(false);

  // 설문조사
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);

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

  const fetchDinnerRequests = useCallback(() => {
    fetch(`/api/meals/dinner-request?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.requests)) {
          setDinnerRequests(data.requests);
          setDinnerDeadlines(data.deadlines || null);
        }
      })
      .catch(() => {});
  }, [batchId]);

  useEffect(() => {
    if (tab === "meals") {
      fetchMeals();
      fetchDinnerRequests();
    }
  }, [tab, fetchMeals, fetchDinnerRequests]);

  const handleDinnerRequest = async () => {
    setDinnerSubmitting(true);
    try {
      const res = await fetch("/api/meals/dinner-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (res.ok) {
        fetchDinnerRequests();
      } else {
        const err = await res.json();
        alert(err.error || "석식 신청 실패");
      }
    } catch {
      alert("석식 신청 중 오류가 발생했습니다.");
    } finally {
      setDinnerSubmitting(false);
    }
  };

  const handleDinnerCancel = async (requestId: string) => {
    const res = await fetch("/api/meals/dinner-request", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action: "cancel" }),
    });
    if (res.ok) {
      fetchDinnerRequests();
    } else {
      const err = await res.json();
      alert(err.error || "취소 실패");
    }
  };

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

  // 설문조사 fetch
  const fetchSurveys = useCallback(() => {
    setSurveysLoading(true);
    fetch("/api/surveys")
      .then((r) => r.json())
      .then((data: Survey[]) => setSurveys(data))
      .finally(() => setSurveysLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "survey") fetchSurveys();
  }, [tab, fetchSurveys]);

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
    { key: "survey", label: "설문조사" },
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
        <div className="space-y-4">
          {/* 참석 가능 현황 신고 폼 */}
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

          {/* 훈련별 출석 현황 */}
          {(batch.trainings || []).length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h3 className="font-semibold text-sm text-gray-800">훈련별 출석 현황</h3>
              </div>
              <div className="divide-y">
                {grouped.map(([, dayTrainings]) =>
                  dayTrainings.map((t) => {
                    const myAtt = t.attendances?.[0];
                    const attStatus = myAtt?.status;
                    return (
                      <div key={t.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[t.type] || TYPE_COLORS["기타"]}`}>
                              {t.type}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{t.title}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDate(t.date)}
                            {t.startTime && t.endTime && ` ${t.startTime}~${t.endTime}`}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          attStatus === "PRESENT" ? "bg-green-100 text-green-700" :
                          attStatus === "ABSENT" ? "bg-red-100 text-red-700" :
                          attStatus === "PENDING" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-400"
                        }`}>
                          {attStatus === "PRESENT" ? "출석" :
                           attStatus === "ABSENT" ? "결석" :
                           attStatus === "PENDING" ? "대기" : "미기록"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
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
          ) : (
            <div className="space-y-4">
              {/* 식사 목록 (세로 배치, 날짜 중복 제거) */}
              {meals.length > 0 ? (
                <div className="space-y-2">
                  {(() => {
                    let lastDateKey = "";
                    return mealDates.flatMap(([dateKey, dayMeals]) => {
                      const items: React.ReactNode[] = [];
                      const showDate = dateKey !== lastDateKey;
                      lastDateKey = dateKey;
                      if (showDate) {
                        items.push(
                          <h3 key={`date-${dateKey}`} className="text-sm font-semibold text-gray-700 pt-2 px-1">
                            {formatDate(dayMeals[0].date)}
                          </h3>
                        );
                      }
                      for (const mealType of ["BREAKFAST", "LUNCH", "DINNER"] as const) {
                        const meal = dayMeals.find((m) => m.type === mealType);
                        if (!meal) continue;
                        items.push(
                          <div
                            key={`${dateKey}-${mealType}`}
                            className="bg-white rounded-xl border p-4 flex items-center justify-between"
                          >
                            <div>
                              <span className="text-xs font-medium text-gray-500">{MEAL_TYPE_LABELS[mealType]}</span>
                              <p className="text-sm text-gray-800 mt-0.5">{meal.menuInfo || "-"}</p>
                            </div>
                          </div>
                        );
                      }
                      return items;
                    });
                  })()}
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  등록된 식사 정보가 없습니다.
                </div>
              )}

              {/* 석식 신청 */}
              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">석식 별도 신청</h3>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                  <ul className="text-xs text-blue-700 space-y-1.5">
                    <li>
                      - 석식 신청 마감: <span className="font-bold">훈련 시작일 9근무일 전</span>
                      {dinnerDeadlines && (
                        <span className="ml-1 text-blue-600 font-semibold">
                          ({new Date(dinnerDeadlines.applyDeadline).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}까지)
                        </span>
                      )}
                    </li>
                    <li>
                      - 석식 취소(환불) 마감: <span className="font-bold">훈련 시작일 3근무일 전</span>
                      {dinnerDeadlines && (
                        <span className="ml-1 text-blue-600 font-semibold">
                          ({new Date(dinnerDeadlines.cancelDeadline).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}까지)
                        </span>
                      )}
                    </li>
                  </ul>
                </div>

                {/* 신청 버튼 (아직 신청하지 않은 경우만) */}
                {dinnerRequests.filter((dr) => dr.status === "PENDING" || dr.status === "APPROVED").length === 0 && (() => {
                  const isExpired = dinnerDeadlines
                    ? new Date().setHours(0, 0, 0, 0) > new Date(dinnerDeadlines.applyDeadline).setHours(0, 0, 0, 0)
                    : false;
                  return (
                    <button
                      onClick={isExpired ? undefined : handleDinnerRequest}
                      disabled={dinnerSubmitting || isExpired}
                      className={`w-full py-2.5 text-sm font-medium rounded-lg mb-3 ${
                        isExpired
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      }`}
                    >
                      {dinnerSubmitting ? "신청 중..." : isExpired ? "신청 제한(신청기한 지남)" : "석식 신청"}
                    </button>
                  );
                })()}

                {/* 내 석식 신청 내역 */}
                {dinnerRequests.length > 0 && (
                  <div className="space-y-2">
                    {dinnerRequests.map((dr) => {
                      const stMap: Record<string, { label: string; color: string }> = {
                        PENDING: { label: "대기", color: "bg-yellow-100 text-yellow-700" },
                        APPROVED: { label: "승인", color: "bg-green-100 text-green-700" },
                        REJECTED: { label: "반려", color: "bg-red-100 text-red-700" },
                        CANCELLED: { label: "취소", color: "bg-gray-100 text-gray-500" },
                      };
                      const st = stMap[dr.status] || { label: dr.status, color: "bg-gray-100 text-gray-600" };
                      const createdTime = new Date(dr.createdAt).toLocaleString("ko-KR", {
                        month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                      });
                      const updatedTime = dr.updatedAt && dr.updatedAt !== dr.createdAt
                        ? new Date(dr.updatedAt).toLocaleString("ko-KR", {
                            month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                          })
                        : null;

                      return (
                        <div key={dr.id} className="bg-white rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                              {st.label}
                            </span>
                            {(dr.status === "PENDING" || dr.status === "APPROVED") && (
                              <button
                                onClick={() => handleDinnerCancel(dr.id)}
                                className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                              >
                                취소
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 space-y-0.5">
                            <p>신청: {createdTime}</p>
                            {updatedTime && dr.status === "CANCELLED" && (
                              <p>취소: {updatedTime}</p>
                            )}
                            {updatedTime && dr.status === "APPROVED" && (
                              <p>승인: {updatedTime}</p>
                            )}
                            {updatedTime && dr.status === "REJECTED" && (
                              <p>반려: {updatedTime}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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

      {/* ═══ 6. 설문조사 탭 ═══ */}
      {tab === "survey" && (
        <>
          {surveysLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : surveys.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              등록된 설문조사가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {surveys.map((s) => (
                <Link
                  key={s.id}
                  href={`/surveys?id=${s.id}`}
                  className="block bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <h4 className="font-semibold text-sm text-gray-900">{s.title}</h4>
                  {s.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{s.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {s.startDate && s.endDate && (
                      <span>
                        {new Date(s.startDate).toLocaleDateString("ko-KR")} ~ {new Date(s.endDate).toLocaleDateString("ko-KR")}
                      </span>
                    )}
                    <span>응답 {s._count.responses}건</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
