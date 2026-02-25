"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
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
  users: { id: string; name: string; rank?: string | null; serviceNumber?: string | null; unit?: string | null; batchUserId?: string; batchStatus?: string; batchSubStatus?: string | null; batchReason?: string | null; batchExpectedConfirmAt?: string | null }[];
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
  // 날짜별로 정렬 후, 각 날짜 내 훈련을 시간순 정렬
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, dayTrainings]) => [key, dayTrainings.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))] as [string, Training[]]);
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

interface ReasonReport {
  id: string;
  batchUserId: string;
  type: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const SUB_STATUS_LABELS: Record<string, string> = {
  NORMAL: "정상",
  LATE_ARRIVAL: "지연입소",
  EARLY_DEPARTURE: "조기퇴소",
};

const REASON_TYPE_LABELS: Record<string, string> = {
  LATE_ARRIVAL: "지연입소 사유서",
  EARLY_DEPARTURE: "조기퇴소 사유서",
  ABSENT: "불참 사유서",
};

type TabType = "attendance" | "training" | "health" | "meals" | "commuting" | "payment" | "survey";

export default function ReservistBatchDetailPage() {
  const params = useParams();
  const { data: session } = useSession();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>("attendance");

  // 참석 신고 상태
  const [attendanceStatus, setAttendanceStatus] = useState<string>("PENDING");
  const [subStatus, setSubStatus] = useState<string>("NORMAL");
  const [reason, setReason] = useState("");
  const [expectedConfirmAt, setExpectedConfirmAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // 사유서 관련
  const [batchUserId, setBatchUserId] = useState<string>("");
  const [reasonReports, setReasonReports] = useState<ReasonReport[]>([]);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalType, setReasonModalType] = useState<string>("");
  const [reasonContent, setReasonContent] = useState("");
  const [reasonDate, setReasonDate] = useState("");
  const [reasonTime, setReasonTime] = useState("");
  const [reasonSaving, setReasonSaving] = useState(false);

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

  // 건강관리 문진표
  const [healthAnswers, setHealthAnswers] = useState<Record<string, boolean | string>>({
    q1_chronic: false, q1_chronic_detail: "",
    q2_treating: false,
    q3_medication: false, q3_medication_detail: "",
    q4_exercise_symptoms: false,
    q5_blood_pressure_meds: false,
    q6_fatigue: false,
    q7_mental: false,
    q8_family_history: false,
    q9_covid_1: false, q9_covid_2: false, q9_covid_3: false, q9_covid_4: false,
    q10_training_issue: false,
    q11_other: "",
    bloodPressure: "",
    temperature: "",
  });
  const [healthSubmitted, setHealthSubmitted] = useState(false);
  const [healthSaving, setHealthSaving] = useState(false);
  const [healthSubmittedAt, setHealthSubmittedAt] = useState<string | null>(null);

  // 설문조사
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveysLoading, setSurveysLoading] = useState(false);

  const fetchReasonReports = useCallback((buId: string) => {
    fetch(`/api/reason-reports?batchUserId=${buId}`)
      .then((r) => r.json())
      .then((data: ReasonReport[]) => setReasonReports(Array.isArray(data) ? data : []));
  }, []);

  const fetchHealthQuestionnaire = useCallback((buId: string) => {
    fetch(`/api/health-questionnaire?batchUserId=${buId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.answers) {
          try {
            const parsed = JSON.parse(data.answers);
            setHealthAnswers(parsed);
          } catch { /* ignore */ }
          setHealthSubmitted(true);
          setHealthSubmittedAt(data.submittedAt || null);
        }
      });
  }, []);

  const fetchBatch = useCallback(() => {
    setLoading(true);
    fetch(`/api/batches/${batchId}`)
      .then((r) => r.json())
      .then((data: Batch) => {
        setBatch(data);
        const me = data.users?.[0];
        if (me) {
          setAttendanceStatus(me.batchStatus || "PENDING");
          setSubStatus(me.batchSubStatus || "NORMAL");
          setReason(me.batchReason || "");
          setExpectedConfirmAt(me.batchExpectedConfirmAt ? new Date(me.batchExpectedConfirmAt).toISOString().slice(0, 16) : "");
          if (me.batchUserId) {
            setBatchUserId(me.batchUserId);
            fetchReasonReports(me.batchUserId);
            fetchHealthQuestionnaire(me.batchUserId);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [batchId, fetchReasonReports, fetchHealthQuestionnaire]);

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
    if (attendanceStatus === "PRESENT") body.subStatus = subStatus || "NORMAL";
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
        fetchBatch();
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const openReasonModal = (type: string) => {
    setReasonModalType(type);
    const existing = reasonReports.find((r) => r.type === type);
    if (existing) {
      try {
        const parsed = JSON.parse(existing.content);
        setReasonContent(parsed.reason || "");
        if (type === "EARLY_DEPARTURE") {
          setReasonDate(parsed.departureDate || "");
          setReasonTime(parsed.departureTime || "");
        } else if (type === "LATE_ARRIVAL") {
          setReasonDate(parsed.arrivalDate || parsed.date || "");
          setReasonTime(parsed.arrivalTime || parsed.time || "");
        } else {
          setReasonDate("");
          setReasonTime("");
        }
      } catch {
        setReasonContent(existing.content);
        setReasonDate("");
        setReasonTime("");
      }
    } else {
      setReasonContent("");
      setReasonDate("");
      setReasonTime("");
    }
    setShowReasonModal(true);
  };

  const handleSaveReason = async () => {
    if (!batchUserId || !reasonModalType) return;
    setReasonSaving(true);
    let contentObj: Record<string, string>;
    if (reasonModalType === "EARLY_DEPARTURE") {
      contentObj = { reason: reasonContent, departureDate: reasonDate, departureTime: reasonTime };
    } else if (reasonModalType === "LATE_ARRIVAL") {
      contentObj = { reason: reasonContent, arrivalDate: reasonDate, arrivalTime: reasonTime };
    } else {
      contentObj = { reason: reasonContent };
    }
    const content = JSON.stringify(contentObj);
    try {
      const res = await fetch("/api/reason-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchUserId, type: reasonModalType, content }),
      });
      if (res.ok) {
        setShowReasonModal(false);
        fetchReasonReports(batchUserId);
      }
    } catch { /* ignore */ }
    setReasonSaving(false);
  };

  const handleSaveHealth = async () => {
    if (!batchUserId) return;
    setHealthSaving(true);
    const answersWithTime = { ...healthAnswers, submittedAt: new Date().toISOString() };
    try {
      const res = await fetch("/api/health-questionnaire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchUserId, answers: JSON.stringify(answersWithTime) }),
      });
      if (res.ok) {
        setHealthSubmitted(true);
        setHealthSubmittedAt(new Date().toISOString());
      }
    } catch { /* ignore */ }
    setHealthSaving(false);
  };

  if (loading || !batch) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const grouped = groupByDate(batch.trainings || []);
  const isActive = batch.status === "ACTIVE";

  // 식사 데이터를 날짜별로 그룹핑
  const mealsByDate: Record<string, Meal[]> = {};
  for (const m of meals) {
    const key = new Date(m.date).toISOString().slice(0, 10);
    if (!mealsByDate[key]) mealsByDate[key] = [];
    mealsByDate[key].push(m);
  }
  const mealDates = Object.entries(mealsByDate).sort(([a], [b]) => a.localeCompare(b));

  // 사유서 표시 조건
  const showReasonButton = batchUserId && (
    (attendanceStatus === "PRESENT" && subStatus === "LATE_ARRIVAL") ||
    (attendanceStatus === "PRESENT" && subStatus === "EARLY_DEPARTURE") ||
    (attendanceStatus === "ABSENT")
  );

  const getReasonButtonType = (): string | null => {
    if (attendanceStatus === "PRESENT" && subStatus === "LATE_ARRIVAL") return "LATE_ARRIVAL";
    if (attendanceStatus === "PRESENT" && subStatus === "EARLY_DEPARTURE") return "EARLY_DEPARTURE";
    if (attendanceStatus === "ABSENT") return "ABSENT";
    return null;
  };

  const reasonType = getReasonButtonType();

  const tabs: { key: TabType; label: string; disabled?: boolean }[] = [
    { key: "attendance", label: "참석신고" },
    { key: "training", label: "훈련계획" },
    { key: "health", label: "건강문진표", disabled: !isActive },
    { key: "meals", label: "식사현황" },
    { key: "commuting", label: "출퇴근" },
    { key: "payment", label: "훈련비" },
    { key: "survey", label: "설문조사" },
  ];

  // 탭 변경 시 비활성 탭 클릭 방지
  const handleTabClick = (t: typeof tabs[0]) => {
    if (t.disabled) return;
    setTab(t.key);
  };

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
            onClick={() => handleTabClick(t)}
            disabled={t.disabled}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              tab === t.key
                ? "bg-white shadow text-blue-600"
                : t.disabled
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ 1. 참석신고 탭 ═══ */}
      {tab === "attendance" && (
        <div className="space-y-4">
          {/* 참석 가능 현황 신고 폼 + 사유서 통합 */}
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

            {attendanceStatus === "PRESENT" && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">세부 상태</label>
                <div className="space-y-2">
                  {[
                    { value: "NORMAL", label: "정상" },
                    { value: "LATE_ARRIVAL", label: "지연입소" },
                    { value: "EARLY_DEPARTURE", label: "조기퇴소" },
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        subStatus === opt.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="subStatus"
                        value={opt.value}
                        checked={subStatus === opt.value}
                        onChange={(e) => { setSubStatus(e.target.value); setSaved(false); setError(""); }}
                        className="text-green-600"
                      />
                      <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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

            {/* ── 사유서 영역 (참석 가능 현황 카드 내부) ── */}
            {batchUserId && (
              <div className="border-t pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-gray-600">사유서</h4>

                {showReasonButton && reasonType && (
                  <button
                    onClick={() => openReasonModal(reasonType)}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium text-white ${
                      reasonType === "ABSENT" ? "bg-red-500 hover:bg-red-600" :
                      reasonType === "EARLY_DEPARTURE" ? "bg-orange-500 hover:bg-orange-600" :
                      "bg-yellow-500 hover:bg-yellow-600"
                    }`}
                  >
                    {reasonReports.find((r) => r.type === reasonType)
                      ? `${REASON_TYPE_LABELS[reasonType]} 수정`
                      : `${REASON_TYPE_LABELS[reasonType]} 작성`}
                  </button>
                )}

                {attendanceStatus === "PRESENT" && subStatus === "NORMAL" && (
                  <p className="text-xs text-gray-400 text-center py-1">정상 참석 시 사유서가 필요하지 않습니다.</p>
                )}
                {attendanceStatus === "PENDING" && (
                  <p className="text-xs text-gray-400 text-center py-1">참석 여부를 확정한 후 사유서를 작성할 수 있습니다.</p>
                )}

                {/* 기존 사유서 목록 */}
                {reasonReports.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500">작성된 사유서</p>
                    {reasonReports.map((r) => (
                      <div key={r.id} className="p-3 bg-gray-50 rounded-lg text-xs">
                        <span className="font-medium text-gray-700">{REASON_TYPE_LABELS[r.type] || r.type}</span>
                        <span className="text-gray-400 ml-2">
                          제출: {new Date(r.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
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
            <div className="space-y-4">
              {grouped.map(([dateKey, dayTrainings]) => (
                <div key={dateKey} className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm">{formatDate(dayTrainings[0].date)}</h3>
                    <p className="text-xs text-gray-500">{dayTrainings.length}개 훈련</p>
                  </div>
                  <div className="divide-y">
                    {dayTrainings.map((t) => (
                      <div key={t.id} className="px-4 py-3">
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

      {/* ═══ 3. 건강관리 문진표 탭 ═══ */}
      {tab === "health" && isActive && (
        <div className="space-y-4">
          {!batchUserId ? (
            <div className="text-center py-10 text-gray-500">차수에 배정되지 않았습니다.</div>
          ) : attendanceStatus !== "PRESENT" ? (
            <div className="text-center py-10 text-gray-500">참석 상태일 때만 문진표를 작성할 수 있습니다.</div>
          ) : (
            <>
              {/* 제출 상태 */}
              {healthSubmitted && (
                <div className="bg-white rounded-xl border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">제출 완료</span>
                    {healthSubmittedAt && (
                      <span className="text-xs text-gray-400">
                        제출: {new Date(healthSubmittedAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 문진표 폼 (인라인) */}
              <div className="bg-white rounded-xl border p-5 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">건강관리 문진표</h3>

                <div className="space-y-3 text-sm">
                  {[
                    { key: "q1_chronic", label: "1. 만성질환(고혈압, 당뇨, 심장질환 등)이 있습니까?", detail: "q1_chronic_detail", detailLabel: "질환명" },
                    { key: "q2_treating", label: "2. 현재 치료 중인 질병이 있습니까?" },
                    { key: "q3_medication", label: "3. 과거 병력 또는 현재 약물을 복용하고 있습니까?", detail: "q3_medication_detail", detailLabel: "질환명/약물" },
                    { key: "q4_exercise_symptoms", label: "4. 운동 중 흉통, 호흡곤란, 현기증 등의 증상을 경험한 적이 있습니까?" },
                    { key: "q5_blood_pressure_meds", label: "5. 혈압약을 복용하고 있습니까?" },
                    { key: "q6_fatigue", label: "6. 최근 지속적인 피로감이나 건강 이상을 느끼고 있습니까?" },
                    { key: "q7_mental", label: "7. 정신과적 증상(우울, 불안, 수면장애 등)이 있습니까?" },
                    { key: "q8_family_history", label: "8. 부모님 중 심혈관 질환(심근경색, 뇌졸중 등)으로 사망하신 분이 있습니까?" },
                  ].map((q) => (
                    <div key={q.key} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-800 mb-2">{q.label}</p>
                      <div className="flex gap-3">
                        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${healthAnswers[q.key] ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 hover:bg-gray-100"}`}>
                          <input
                            type="radio"
                            name={q.key}
                            checked={!!healthAnswers[q.key]}
                            onChange={() => setHealthAnswers({ ...healthAnswers, [q.key]: true })}
                            className="text-red-600"
                          />
                          있음
                        </label>
                        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${!healthAnswers[q.key] ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 hover:bg-gray-100"}`}>
                          <input
                            type="radio"
                            name={q.key}
                            checked={!healthAnswers[q.key]}
                            onChange={() => setHealthAnswers({ ...healthAnswers, [q.key]: false })}
                            className="text-green-600"
                          />
                          없음
                        </label>
                      </div>
                      {q.detail && healthAnswers[q.key] && (
                        <input
                          type="text"
                          value={(healthAnswers[q.detail] as string) || ""}
                          onChange={(e) => setHealthAnswers({ ...healthAnswers, [q.detail!]: e.target.value })}
                          placeholder={q.detailLabel}
                          className="mt-2 w-full px-3 py-1.5 border rounded text-sm"
                        />
                      )}
                    </div>
                  ))}

                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="font-medium mb-2">9. 코로나 관련</p>
                    {[
                      { key: "q9_covid_1", label: "7일 이내 코로나 감염 이력" },
                      { key: "q9_covid_2", label: "1일 이내 감염 확인" },
                      { key: "q9_covid_3", label: "14일 이내 확진자 접촉" },
                      { key: "q9_covid_4", label: "현재 발열, 기침, 인후통 등 증상" },
                    ].map((q) => (
                      <div key={q.key} className="mt-2">
                        <p className="text-sm text-gray-800 mb-1">{q.label}</p>
                        <div className="flex gap-3">
                          <label className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border cursor-pointer text-xs ${healthAnswers[q.key] ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 hover:bg-gray-100"}`}>
                            <input
                              type="radio"
                              name={q.key}
                              checked={!!healthAnswers[q.key]}
                              onChange={() => setHealthAnswers({ ...healthAnswers, [q.key]: true })}
                              className="text-red-600"
                            />
                            있음
                          </label>
                          <label className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border cursor-pointer text-xs ${!healthAnswers[q.key] ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 hover:bg-gray-100"}`}>
                            <input
                              type="radio"
                              name={q.key}
                              checked={!healthAnswers[q.key]}
                              onChange={() => setHealthAnswers({ ...healthAnswers, [q.key]: false })}
                              className="text-green-600"
                            />
                            없음
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-800 mb-2">10. 훈련 수행에 지장이 있는 사항이 있습니까?</p>
                    <div className="flex gap-3">
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${healthAnswers.q10_training_issue ? "border-red-400 bg-red-50 text-red-700" : "border-gray-200 hover:bg-gray-100"}`}>
                        <input
                          type="radio"
                          name="q10_training_issue"
                          checked={!!healthAnswers.q10_training_issue}
                          onChange={() => setHealthAnswers({ ...healthAnswers, q10_training_issue: true })}
                          className="text-red-600"
                        />
                        있음
                      </label>
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm ${!healthAnswers.q10_training_issue ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 hover:bg-gray-100"}`}>
                        <input
                          type="radio"
                          name="q10_training_issue"
                          checked={!healthAnswers.q10_training_issue}
                          onChange={() => setHealthAnswers({ ...healthAnswers, q10_training_issue: false })}
                          className="text-green-600"
                        />
                        없음
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">11. 기타 참고사항</label>
                    <textarea
                      value={(healthAnswers.q11_other as string) || ""}
                      onChange={(e) => setHealthAnswers({ ...healthAnswers, q11_other: e.target.value })}
                      placeholder="기타 건강 관련 참고사항을 입력하세요."
                      rows={2}
                      className="mt-1 w-full px-3 py-2 text-sm border rounded-lg outline-none resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">혈압 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
                      <input
                        type="text"
                        value={(healthAnswers.bloodPressure as string) || ""}
                        onChange={(e) => setHealthAnswers({ ...healthAnswers, bloodPressure: e.target.value })}
                        placeholder="예: 120/80"
                        className="mt-1 w-full px-3 py-2 text-sm border rounded-lg outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">체온 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
                      <input
                        type="text"
                        value={(healthAnswers.temperature as string) || ""}
                        onChange={(e) => setHealthAnswers({ ...healthAnswers, temperature: e.target.value })}
                        placeholder="예: 36.5"
                        className="mt-1 w-full px-3 py-2 text-sm border rounded-lg outline-none"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveHealth}
                  disabled={healthSaving}
                  className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 text-sm"
                >
                  {healthSaving ? "제출 중..." : healthSubmitted ? "수정 제출" : "제출"}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ 4. 식사현황 탭 ═══ */}
      {tab === "meals" && (
        <>
          {mealsLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-4">
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
                            {updatedTime && dr.status === "CANCELLED" && <p>취소: {updatedTime}</p>}
                            {updatedTime && dr.status === "APPROVED" && <p>승인: {updatedTime}</p>}
                            {updatedTime && dr.status === "REJECTED" && <p>반려: {updatedTime}</p>}
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

      {/* ═══ 5. 출퇴근 탭 ═══ */}
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

      {/* ═══ 6. 훈련비 탭 ═══ */}
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

      {/* ═══ 7. 설문조사 탭 ═══ */}
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

      {/* 사유서 작성 모달 */}
      {showReasonModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">
              {reasonModalType === "EARLY_DEPARTURE" ? "조기퇴소 확인서" :
               reasonModalType === "ABSENT" ? "불참 개인 사유서" :
               REASON_TYPE_LABELS[reasonModalType] || "사유서"}
            </h3>

            {/* 인적사항 (자동) */}
            {session?.user && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                {reasonModalType === "ABSENT" ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500">소속:</span> 1군수지원여단 601수송대대</div>
                      <div><span className="text-gray-500">직책:</span> {session.user.position || "-"}</div>
                      <div><span className="text-gray-500">성명:</span> {session.user.name}</div>
                      <div><span className="text-gray-500">생년월일:</span> {session.user.birthDate ? new Date(session.user.birthDate).toLocaleDateString("ko-KR") : "-"}</div>
                      <div><span className="text-gray-500">E-mail:</span> {session.user.email || "-"}</div>
                      <div><span className="text-gray-500">휴대폰:</span> {session.user.phone || "-"}</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500">소속:</span> {session.user.unit || "-"}</div>
                      <div><span className="text-gray-500">직책:</span> {session.user.position || "-"}</div>
                      <div><span className="text-gray-500">성명:</span> {session.user.name}</div>
                      <div><span className="text-gray-500">군번:</span> {session.user.serviceNumber || "-"}</div>
                    </div>
                  </>
                )}
                {batch && (
                  <div className="pt-1 border-t mt-2">
                    <div><span className="text-gray-500">훈련차수:</span> {batch.name}</div>
                    <div><span className="text-gray-500">훈련기간:</span> {new Date(batch.startDate).toLocaleDateString("ko-KR")} ~ {new Date(batch.endDate).toLocaleDateString("ko-KR")}</div>
                  </div>
                )}
              </div>
            )}

            {/* 날짜/시간 입력 - LATE_ARRIVAL */}
            {reasonModalType === "LATE_ARRIVAL" && (
              <div>
                <label className="text-sm font-medium text-gray-700">입소 예정 일시</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <input type="date" value={reasonDate} onChange={(e) => setReasonDate(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                  <input type="time" value={reasonTime} onChange={(e) => setReasonTime(e.target.value)} className="px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
            )}

            {/* 날짜/시간 입력 - EARLY_DEPARTURE */}
            {reasonModalType === "EARLY_DEPARTURE" && (
              <div className="space-y-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">훈련일자</label>
                  <input type="date" value={reasonDate} onChange={(e) => setReasonDate(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">조기퇴소 시간</label>
                  <input type="time" value={reasonTime} onChange={(e) => setReasonTime(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                {reasonModalType === "EARLY_DEPARTURE" ? "조기 퇴소 사유 (본인이 직접 작성)" :
                 reasonModalType === "ABSENT" ? "개인 사유 내용 기술" : "사유"}
              </label>
              <textarea
                value={reasonContent}
                onChange={(e) => setReasonContent(e.target.value)}
                placeholder={reasonModalType === "ABSENT"
                  ? "6하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)에 의거하여 상세히 작성해주세요."
                  : "사유를 상세히 입력해주세요."}
                rows={5}
                className="mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>

            {reasonModalType === "EARLY_DEPARTURE" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800 space-y-1">
                <p>1. 본인은 위 사유로 인하여 비상근 예비군 훈련에서 예정보다 일찍 퇴소하겠습니다.</p>
                <p>2. 본인은 조기퇴소에 대한 안내사항을 사전에 인지하였으며 시간당 평일 12,500원 주말 18,750원의 훈련비가 감액됨을 확인하였습니다.</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSaveReason}
                disabled={reasonSaving || !reasonContent.trim()}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {reasonSaving ? "저장 중..." : "제출"}
              </button>
              <button
                onClick={() => setShowReasonModal(false)}
                className="flex-1 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
