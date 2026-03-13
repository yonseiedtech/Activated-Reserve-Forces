"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";
import { MEAL_TYPE_LABELS } from "@/lib/constants";

interface Meal {
  id: string;
  batchId: string;
  date: string;
  type: string;
  menuInfo: string | null;
  headcount: number;
  batch: { name: string };
}

interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface AttendanceInfo {
  presentCount: number;
  pendingCount: number;
  totalBatchUsers: number;
}

interface DinnerReq {
  id: string;
  date: string;
  status: string;
  note: string | null;
  createdAt: string;
  user: { name: string; rank: string | null; serviceNumber: string | null };
}

// 일자별 식사 입력 데이터
interface DayMealInput {
  date: string; // YYYY-MM-DD
  label: string; // 표시용 (3월 10일 (월))
  BREAKFAST: string;
  LUNCH: string;
  DINNER: string;
}

const DINNER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "대기", color: "bg-yellow-100 text-yellow-700" },
  APPROVED: { label: "승인", color: "bg-green-100 text-green-700" },
  REJECTED: { label: "반려", color: "bg-red-100 text-red-700" },
  CANCELLED: { label: "취소", color: "bg-gray-100 text-gray-500" },
};

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function getDateRange(start: string, end: string): { date: string; label: string }[] {
  const result: { date: string; label: string }[] = [];
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const cur = new Date(s);
  while (cur <= e) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    const label = `${cur.getMonth() + 1}월 ${cur.getDate()}일 (${DAYS[cur.getDay()]})`;
    result.push({ date: iso, label });
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

export default function MealsPage() {
  const { data: session } = useSession();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");

  // 등록 모달 state
  const [showForm, setShowForm] = useState(false);
  const [dayMealInputs, setDayMealInputs] = useState<DayMealInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editForm, setEditForm] = useState({ menuInfo: "", headcount: 0 });

  // Inline registration state
  const [inlineMealKey, setInlineMealKey] = useState<string | null>(null); // "isoDate-TYPE"
  const [inlineMealValue, setInlineMealValue] = useState("");

  // Attendance info per date
  const [attendanceByDate, setAttendanceByDate] = useState<Record<string, AttendanceInfo>>({});

  // 석식 신청 state
  const [dinnerTab, setDinnerTab] = useState<"meals" | "dinner">("meals");
  const [dinnerRequests, setDinnerRequests] = useState<DinnerReq[]>([]);
  const [dinnerDate, setDinnerDate] = useState("");
  const [dinnerSubmitting, setDinnerSubmitting] = useState(false);

  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER" || session?.user?.role === "COOK";

  useEffect(() => {
    fetch("/api/batches").then((r) => r.json()).then((data) => {
      setBatches(data);
      if (data.length > 0) setSelectedBatch(data[0].id);
    });
  }, []);

  const fetchMeals = useCallback(() => {
    if (selectedBatch) {
      fetch(`/api/meals?batchId=${selectedBatch}`).then((r) => r.json()).then(setMeals);
    }
  }, [selectedBatch]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  // Fetch attendance info for each unique date
  useEffect(() => {
    if (!selectedBatch || meals.length === 0) return;

    const dates = [...new Set(meals.map((m) => new Date(m.date).toISOString().split("T")[0]))];
    const fetchAll = async () => {
      const results: Record<string, AttendanceInfo> = {};
      await Promise.all(
        dates.map(async (date) => {
          try {
            const res = await fetch(`/api/meals/attendance-count?batchId=${selectedBatch}&date=${date}`);
            if (res.ok) {
              results[date] = await res.json();
            }
          } catch { /* ignore */ }
        })
      );
      setAttendanceByDate(results);
    };
    fetchAll();
  }, [selectedBatch, meals]);

  // 등록 모달 열기: 차수 날짜 범위로 일자 목록 생성, 기존 메뉴 반영
  const handleOpenForm = () => {
    const batch = batches.find((b) => b.id === selectedBatch);
    if (!batch) return;

    const dateRange = getDateRange(batch.startDate, batch.endDate);
    const inputs: DayMealInput[] = dateRange.map(({ date, label }) => {
      // 기존에 등록된 식사가 있으면 메뉴 정보를 미리 채움
      const existing = meals.filter((m) => new Date(m.date).toISOString().split("T")[0] === date);
      return {
        date,
        label,
        BREAKFAST: existing.find((m) => m.type === "BREAKFAST")?.menuInfo || "",
        LUNCH: existing.find((m) => m.type === "LUNCH")?.menuInfo || "",
        DINNER: existing.find((m) => m.type === "DINNER")?.menuInfo || "",
      };
    });
    setDayMealInputs(inputs);
    setShowForm(true);
  };

  const handleMealInputChange = (index: number, type: "BREAKFAST" | "LUNCH" | "DINNER", value: string) => {
    setDayMealInputs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [type]: value };
      return next;
    });
  };

  // 일괄 저장
  const handleBulkSubmit = async () => {
    setSubmitting(true);
    try {
      const promises: Promise<Response>[] = [];
      for (const day of dayMealInputs) {
        for (const type of ["BREAKFAST", "LUNCH", "DINNER"] as const) {
          const menuInfo = day[type].trim();
          if (menuInfo) {
            promises.push(
              fetch("/api/meals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  batchId: selectedBatch,
                  date: day.date,
                  type,
                  menuInfo,
                  headcount: 0,
                }),
              })
            );
          }
        }
      }
      await Promise.all(promises);
      setShowForm(false);
      fetchMeals();
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (meal: Meal) => {
    setEditingMeal(meal);
    setEditForm({ menuInfo: meal.menuInfo || "", headcount: meal.headcount });
  };

  const handleEditSave = async () => {
    if (!editingMeal) return;
    const res = await fetch(`/api/meals/${editingMeal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setEditingMeal(null);
      fetchMeals();
    }
  };

  const handleDelete = async (mealId: string) => {
    if (!confirm("식사 정보를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/meals/${mealId}`, { method: "DELETE" });
    if (res.ok) fetchMeals();
  };

  const handleApplyAttendance = (dateKey: string) => {
    const info = attendanceByDate[dateKey];
    if (!info) return;
    setEditForm((prev) => ({ ...prev, headcount: info.presentCount }));
  };

  // 석식 신청 목록 조회
  const fetchDinnerRequests = useCallback(() => {
    if (!selectedBatch) return;
    fetch(`/api/meals/dinner-request?batchId=${selectedBatch}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.requests)) setDinnerRequests(data.requests);
        else if (Array.isArray(data)) setDinnerRequests(data);
      })
      .catch(() => {});
  }, [selectedBatch]);

  useEffect(() => {
    if (dinnerTab === "dinner") fetchDinnerRequests();
  }, [dinnerTab, fetchDinnerRequests]);

  const handleDinnerRequest = async () => {
    if (!dinnerDate || !selectedBatch) return;
    setDinnerSubmitting(true);
    try {
      const res = await fetch("/api/meals/dinner-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedBatch, date: dinnerDate }),
      });
      if (res.ok) {
        setDinnerDate("");
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

  const handleDinnerAction = async (requestId: string, action: "approve" | "reject" | "cancel") => {
    const res = await fetch("/api/meals/dinner-request", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    });
    if (res.ok) {
      fetchDinnerRequests();
    } else {
      const err = await res.json();
      alert(err.error || "처리 실패");
    }
  };

  // 날짜별 그룹핑
  const grouped = meals.reduce<Record<string, Meal[]>>((acc, m) => {
    const d = new Date(m.date).toLocaleDateString("ko-KR");
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {});

  // date display -> ISO date key mapping
  const dateKeyMap: Record<string, string> = {};
  for (const m of meals) {
    const display = new Date(m.date).toLocaleDateString("ko-KR");
    const isoKey = new Date(m.date).toISOString().split("T")[0];
    dateKeyMap[display] = isoKey;
  }

  // 선택된 차수의 날짜 범위로 빈 날짜도 포함하여 표시
  const selectedBatchData = batches.find((b) => b.id === selectedBatch);
  const allDates = selectedBatchData ? getDateRange(selectedBatchData.startDate, selectedBatchData.endDate) : [];

  return (
    <div>
      <PageTitle
        title="식사 관리"
        description="차수별 식사 메뉴 및 인원을 관리합니다."
        actions={
          canEdit ? (
            <button onClick={handleOpenForm} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + 식사 등록
            </button>
          ) : undefined
        }
      />

      {/* 차수 선택 */}
      <div className="mb-4">
        <select
          value={selectedBatch}
          onChange={(e) => setSelectedBatch(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
        >
          {batches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* 탭: 식사 / 석식 신청 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setDinnerTab("meals")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            dinnerTab === "meals" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          식사 현황
        </button>
        <button
          onClick={() => setDinnerTab("dinner")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            dinnerTab === "dinner" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          석식 신청
        </button>
      </div>

      {/* 석식 신청 탭 */}
      {dinnerTab === "dinner" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-2">석식 신청 안내</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>- 석식 신청은 해당일 <span className="font-bold">9근무일 전</span>까지 가능합니다.</li>
              <li>- 석식 취소(환불)는 해당일 <span className="font-bold">3일 전</span>까지 가능합니다.</li>
            </ul>
          </div>

          {!canEdit && (
            <div className="bg-white rounded-xl border p-4">
              <h4 className="text-sm font-semibold mb-3">석식 신청하기</h4>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dinnerDate}
                  onChange={(e) => setDinnerDate(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button
                  onClick={handleDinnerRequest}
                  disabled={!dinnerDate || dinnerSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                >
                  {dinnerSubmitting ? "신청 중..." : "석식 신청"}
                </button>
              </div>
            </div>
          )}

          {dinnerRequests.length > 0 ? (
            <div className="space-y-3">
              {dinnerRequests.map((dr) => {
                const st = DINNER_STATUS_LABELS[dr.status] || { label: dr.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={dr.id} className="bg-white rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        {canEdit && (
                          <p className="text-sm font-medium">
                            {dr.user.rank} {dr.user.name}
                            <span className="text-gray-400 text-xs ml-2">{dr.user.serviceNumber}</span>
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          {new Date(dr.date).toLocaleDateString("ko-KR")} 석식
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          신청일: {new Date(dr.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                        {canEdit && dr.status === "PENDING" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleDinnerAction(dr.id, "approve")}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleDinnerAction(dr.id, "reject")}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              반려
                            </button>
                          </div>
                        )}
                        {!canEdit && (dr.status === "PENDING" || dr.status === "APPROVED") && (
                          <button
                            onClick={() => handleDinnerAction(dr.id, "cancel")}
                            className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                          >
                            취소
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center py-8 text-gray-400">석식 신청 내역이 없습니다.</p>
          )}
        </div>
      )}

      {/* 날짜별 식사 목록 - 차수의 전체 일자 표시 */}
      {dinnerTab === "meals" && (
      <div className="space-y-4">
        {allDates.length > 0 ? allDates.map(({ date: isoDate, label: dayLabel }) => {
          const dayMeals = meals.filter((m) => new Date(m.date).toISOString().split("T")[0] === isoDate);
          const attInfo = attendanceByDate[isoDate];
          const isWeekend = new Date(isoDate + "T00:00:00").getDay() === 0 || new Date(isoDate + "T00:00:00").getDay() === 6;
          return (
            <div key={isoDate} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${isWeekend ? "text-red-500" : ""}`}>{dayLabel}</h3>
                {attInfo && (
                  <span className="text-xs text-gray-500">
                    참석 확정: <span className="font-medium text-green-600">{attInfo.presentCount}명</span>
                    {attInfo.pendingCount > 0 && (
                      <> | 미정: <span className="font-medium text-yellow-600">{attInfo.pendingCount}명</span></>
                    )}
                  </span>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {["BREAKFAST", "LUNCH", "DINNER"].map((type) => {
                  const meal = dayMeals.find((m) => m.type === type);
                  return (
                    <div
                      key={type}
                      className={`p-3 rounded-lg ${meal ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"} ${!meal && canEdit && inlineMealKey !== `${isoDate}-${type}` ? "cursor-pointer hover:bg-gray-100" : ""}`}
                      onClick={() => {
                        if (!meal && canEdit && inlineMealKey !== `${isoDate}-${type}`) {
                          setInlineMealKey(`${isoDate}-${type}`);
                          setInlineMealValue("");
                        }
                      }}
                    >
                      <p className="text-xs font-medium text-gray-500 mb-1">{MEAL_TYPE_LABELS[type]}</p>
                      {meal ? (
                        <>
                          <p className="text-sm">{meal.menuInfo || "메뉴 미등록"}</p>
                          <p className="text-xs text-gray-400 mt-1">{meal.headcount}명</p>
                          {canEdit && (
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleEditOpen(meal)}
                                className="text-xs text-blue-600 hover:underline"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(meal.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                삭제
                              </button>
                            </div>
                          )}
                        </>
                      ) : inlineMealKey === `${isoDate}-${type}` ? (
                        <div className="flex gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={inlineMealValue}
                            onChange={(e) => setInlineMealValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && inlineMealValue.trim()) {
                                await fetch("/api/meals", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ batchId: selectedBatch, date: isoDate, type, menuInfo: inlineMealValue.trim(), headcount: 0 }),
                                });
                                setInlineMealKey(null);
                                fetchMeals();
                              } else if (e.key === "Escape") {
                                setInlineMealKey(null);
                              }
                            }}
                            placeholder="메뉴 입력 후 Enter"
                            className="flex-1 px-2 py-1 border rounded text-sm min-w-0"
                          />
                          <button
                            onClick={async () => {
                              if (!inlineMealValue.trim()) return;
                              await fetch("/api/meals", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ batchId: selectedBatch, date: isoDate, type, menuInfo: inlineMealValue.trim(), headcount: 0 }),
                              });
                              setInlineMealKey(null);
                              fetchMeals();
                            }}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-xs shrink-0"
                          >
                            등록
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400">{canEdit ? "터치하여 등록" : "미등록"}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }) : (
          <p className="text-center py-8 text-gray-400">차수를 선택하세요.</p>
        )}
      </div>
      )}

      {/* 등록 모달 - 차수 연동 일자별 식사 입력 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">식사 메뉴 등록</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedBatchData?.name} ({dayMealInputs.length}일)
                </p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {dayMealInputs.map((day, index) => {
                const isWeekend = new Date(day.date + "T00:00:00").getDay() === 0 || new Date(day.date + "T00:00:00").getDay() === 6;
                return (
                  <div key={day.date} className={`border rounded-lg p-4 ${isWeekend ? "border-red-200 bg-red-50/30" : ""}`}>
                    <p className={`text-sm font-semibold mb-3 ${isWeekend ? "text-red-500" : "text-gray-700"}`}>
                      {day.label}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">조식</label>
                        <input
                          type="text"
                          value={day.BREAKFAST}
                          onChange={(e) => handleMealInputChange(index, "BREAKFAST", e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                          placeholder="메뉴 입력"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">중식</label>
                        <input
                          type="text"
                          value={day.LUNCH}
                          onChange={(e) => handleMealInputChange(index, "LUNCH", e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                          placeholder="메뉴 입력"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">석식</label>
                        <input
                          type="text"
                          value={day.DINNER}
                          onChange={(e) => handleMealInputChange(index, "DINNER", e.target.value)}
                          className="w-full px-2 py-1.5 border rounded text-sm"
                          placeholder="메뉴 입력"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t flex gap-3">
              <button
                onClick={handleBulkSubmit}
                disabled={submitting}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "저장 중..." : "일괄 저장"}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">식사 수정</h3>
            <p className="text-sm text-gray-500">{MEAL_TYPE_LABELS[editingMeal.type]} - {new Date(editingMeal.date).toLocaleDateString("ko-KR")}</p>
            <div>
              <label className="block text-sm font-medium mb-1">메뉴</label>
              <textarea value={editForm.menuInfo} onChange={(e) => setEditForm({ ...editForm, menuInfo: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">인원</label>
              <div className="flex gap-2">
                <input type="number" value={editForm.headcount} onChange={(e) => setEditForm({ ...editForm, headcount: parseInt(e.target.value) || 0 })} className="flex-1 px-3 py-2 border rounded-lg" />
                <button
                  type="button"
                  onClick={() => handleApplyAttendance(new Date(editingMeal.date).toISOString().split("T")[0])}
                  className="px-3 py-2 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 whitespace-nowrap"
                >
                  참석인원 적용
                </button>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleEditSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">저장</button>
              <button onClick={() => setEditingMeal(null)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
