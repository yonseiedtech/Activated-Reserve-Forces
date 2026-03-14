"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";
import ScrollTimePicker from "@/components/ui/ScrollTimePicker";
import { BATCH_STATUS_LABELS, MEAL_TYPE_LABELS } from "@/lib/constants";

interface TrainingCategory {
  id: string;
  name: string;
  order: number;
}

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  instructor: { id: string; name: string } | null;
  attendanceEnabled: boolean;
  countsTowardHours: boolean;
}

interface BatchUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  phone: string | null;
  unit: string | null;
  birthDate?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  position?: string | null;
  warBattalion?: string | null;
  warCompany?: string | null;
  warPlatoon?: string | null;
  batchUserId?: string;
  batchStatus?: string;
  batchSubStatus?: string | null;
  batchReason?: string | null;
  mobilizationCertIssued?: boolean;
}

interface ReasonReportWithUser {
  id: string;
  batchUserId: string;
  type: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  batchUser: {
    user: { id: string; name: string; rank: string | null; serviceNumber: string | null; unit: string | null; branch: string | null };
    batch: { id: string; name: string; startDate: string; endDate: string };
  };
}

interface HealthQuestionnaireWithUser {
  id: string;
  batchUserId: string;
  answers: string;
  submittedAt: string;
  batchUser: {
    user: { id: string; name: string; rank: string | null; serviceNumber: string | null; unit: string | null; birthDate: string | null };
  };
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

interface Batch {
  id: string;
  name: string;
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
  requiredHours: number | null;
  users: BatchUser[];
  trainings: Training[];
  _count: { users: number; trainings: number };
}

interface Instructor {
  id: string;
  name: string;
  role: string;
}

interface UnassignedUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  phone: string | null;
  unit: string | null;
}

interface AttendanceSummary {
  byUser: { userId: string; name: string; rank: string | null; present: number; absent: number; pending: number; total: number; rate: number }[];
  byTraining: { trainingId: string; title: string; date: string; present: number; absent: number; pending: number; total: number; rate: number }[];
}

interface CommutingRecord {
  id: string;
  userId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  isManual: boolean;
  note: string | null;
  supplementaryTraining: boolean;
}

interface AttendanceRecord {
  userId: string;
  status: string;
}

interface CommutingRowData {
  userId: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  checkIn: string;
  checkOut: string;
  note: string;
  attendanceStatus: string;
  batchStatus: string;
  batchUserId: string;
  supplementaryTraining: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

function computeDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return "-";
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return "-";
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function getToday(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split("T")[0];
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  // UTC 기준 날짜 문자열만 추출하여 타임존 오프셋 문제 방지
  const startStr = startDate.split("T")[0];
  const endStr = endDate.split("T")[0];
  // yyyy-MM-dd를 직접 파싱하여 UTC 정오로 생성 (타임존 밀림 방지)
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [ey, em, ed] = endStr.split("-").map(Number);
  const current = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
  const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

const TEST_SN = "18-11165";

export default function AdminBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [tab, setTab] = useState<"training" | "trainees" | "attendance" | "trainingAttendance" | "meals" | "commuting" | "survey" | "settlement">("training");
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [attendanceFilter, setAttendanceFilter] = useState<"ALL" | "PRESENT" | "ABSENT" | "PENDING">("ALL");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [trainingCategories, setTrainingCategories] = useState<TrainingCategory[]>([]);
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [trainingFormDate, setTrainingFormDate] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingForm, setTrainingForm] = useState({
    title: "", type: "기타", startTime: "", endTime: "", location: "", description: "", instructorId: "",
    attendanceEnabled: true, countsTowardHours: true,
  });

  // Edit training state
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", type: "기타", startTime: "", endTime: "", location: "", description: "", instructorId: "",
    attendanceEnabled: true, countsTowardHours: true,
  });

  // Trainee assignment state
  const [unassigned, setUnassigned] = useState<UnassignedUser[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Bulk assignment state
  const [selectedUnassigned, setSelectedUnassigned] = useState<Set<string>>(new Set());
  const [selectedAssigned, setSelectedAssigned] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Attendance summary state
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Commuting state
  const [commutingDate, setCommutingDate] = useState("");
  const [commutingRows, setCommutingRows] = useState<CommutingRowData[]>([]);
  const [commutingLoading, setCommutingLoading] = useState(false);
  const [commutingSaving, setCommutingSaving] = useState(false);

  // 출퇴근 보고 모달
  const [reportType, setReportType] = useState<"checkin" | "checkout" | null>(null);
  const [reportCopied, setReportCopied] = useState(false);

  // 스크롤 타임피커
  const [timePickerTarget, setTimePickerTarget] = useState<{ idx: number; field: "checkIn" | "checkOut" } | null>(null);

  // 사유서 관련
  const [reasonReports, setReasonReports] = useState<ReasonReportWithUser[]>([]);
  const [viewingReport, setViewingReport] = useState<ReasonReportWithUser | null>(null);

  // 건강관리 문진표
  const [healthQuestionnaires, setHealthQuestionnaires] = useState<HealthQuestionnaireWithUser[]>([]);
  const [viewingHealth, setViewingHealth] = useState<HealthQuestionnaireWithUser | null>(null);

  // 위병소 링크 관리
  interface GuardPostTokenData {
    id: string;
    token: string;
    label: string | null;
    isActive: boolean;
    expiresAt: string | null;
    createdAt: string;
  }
  const [guardTokens, setGuardTokens] = useState<GuardPostTokenData[]>([]);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenLabel, setTokenLabel] = useState("");
  const [tokenExpiryType, setTokenExpiryType] = useState<"batch" | "custom" | "none">("batch");
  const [tokenExpiryDate, setTokenExpiryDate] = useState("");

  // Settings modal state
  const [settingsForm, setSettingsForm] = useState({ name: "", year: 0, number: 0, startDate: "", endDate: "", location: "", requiredHours: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Settlement tab state
  interface SettlementRow {
    batchUserId: string;
    userId: string;
    name: string;
    rank: string | null;
    serviceNumber: string | null;
    completedHours: number | null;
    calculatedHours: number | null;
  }
  const [settlementRows, setSettlementRows] = useState<SettlementRow[]>([]);
  const [settlementRequiredHours, setSettlementRequiredHours] = useState<number | null>(null);
  const [settlementStartDate, setSettlementStartDate] = useState<string>("");
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);

  // Meals tab state
  interface MealData {
    id: string;
    batchId: string;
    date: string;
    type: string;
    menuInfo: string | null;
    headcount: number;
  }
  interface DayMealInput {
    date: string;
    label: string;
    BREAKFAST: string;
    LUNCH: string;
    DINNER: string;
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
  const [mealsList, setMealsList] = useState<MealData[]>([]);
  const [mealDayInputs, setMealDayInputs] = useState<DayMealInput[]>([]);
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealSubmitting, setMealSubmitting] = useState(false);
  const [editingMealData, setEditingMealData] = useState<MealData | null>(null);
  const [mealEditForm, setMealEditForm] = useState({ menuInfo: "", headcount: 0 });
  const [inlineMealKey, setInlineMealKey] = useState<string | null>(null);
  const [inlineMealValue, setInlineMealValue] = useState("");
  const [mealAttendanceByDate, setMealAttendanceByDate] = useState<Record<string, AttendanceInfo>>({});
  const [mealDinnerTab, setMealDinnerTab] = useState<"meals" | "dinner">("meals");
  const [dinnerRequests, setDinnerRequests] = useState<DinnerReq[]>([]);

  // Survey tab state
  interface SurveyItem {
    id: string;
    title: string;
    description: string | null;
    questions: string;
    isActive: boolean;
    _count: { responses: number };
    createdAt: string;
  }
  interface SurveyQuestion { q: string; type: string; options: string[]; required?: boolean }
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [showSurveyForm, setShowSurveyForm] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<SurveyItem | null>(null);
  const [surveyForm, setSurveyForm] = useState<{ title: string; description: string; questions: SurveyQuestion[] }>({
    title: "", description: "", questions: [{ q: "", type: "text", options: [], required: true }],
  });

  const fetchBatch = useCallback(() => {
    fetch(`/api/batches/${batchId}`).then((r) => r.json()).then(setBatch);
  }, [batchId]);

  const fetchInstructors = useCallback(() => {
    Promise.all([
      fetch("/api/users?role=ADMIN").then((r) => r.json()),
      fetch("/api/users?role=MANAGER").then((r) => r.json()),
      fetch("/api/users?role=INSTRUCTOR").then((r) => r.json()),
    ]).then(([admins, managers, instructorUsers]: Instructor[][]) => {
      setInstructors([...admins, ...managers, ...instructorUsers]);
    });
  }, []);

  const fetchUnassigned = useCallback(() => {
    fetch("/api/users?role=RESERVIST").then((r) => r.json()).then((users: (UnassignedUser & { batches?: { id: string; name: string }[] })[]) => {
      setUnassigned(users.filter((u) => !u.batches?.some((b) => b.id === batchId)));
    });
  }, [batchId]);

  const fetchAttendanceSummary = useCallback(() => {
    setAttendanceLoading(true);
    fetch(`/api/batches/${batchId}/attendance-summary`)
      .then((r) => r.json())
      .then(setAttendanceSummary)
      .finally(() => setAttendanceLoading(false));
  }, [batchId]);

  const fetchReasonReports = useCallback(() => {
    fetch(`/api/reason-reports?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data: ReasonReportWithUser[]) => setReasonReports(Array.isArray(data) ? data : []));
  }, [batchId]);

  const fetchHealthQuestionnaires = useCallback(() => {
    fetch(`/api/health-questionnaire?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data: HealthQuestionnaireWithUser[]) => setHealthQuestionnaires(Array.isArray(data) ? data : []));
  }, [batchId]);

  const fetchSurveys = useCallback(() => {
    fetch(`/api/surveys?batchId=${batchId}`).then((r) => r.json()).then((data: SurveyItem[]) => setSurveys(Array.isArray(data) ? data : []));
  }, [batchId]);

  const isAuthorized = status === "authenticated" && ["ADMIN", "MANAGER"].includes(session?.user?.role ?? "");

  useEffect(() => {
    if (!isAuthorized) return;
    fetchBatch();
    fetchInstructors();
    fetchUnassigned();
    fetch("/api/training-categories").then((r) => r.json()).then(setTrainingCategories);
  }, [fetchBatch, fetchInstructors, fetchUnassigned, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    if (tab === "attendance" || tab === "trainingAttendance") {
      fetchAttendanceSummary();
      fetchReasonReports();
      fetchHealthQuestionnaires();
    }
  }, [tab, fetchAttendanceSummary, fetchReasonReports, fetchHealthQuestionnaires, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized || tab !== "survey") return;
    fetchSurveys();
  }, [tab, fetchSurveys, isAuthorized]);

  // Meals tab data fetch
  const fetchMealsList = useCallback(() => {
    if (batchId) {
      fetch(`/api/meals?batchId=${batchId}`).then((r) => r.json()).then(setMealsList);
    }
  }, [batchId]);

  const fetchDinnerReqs = useCallback(() => {
    if (!batchId) return;
    fetch(`/api/meals/dinner-request?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.requests)) setDinnerRequests(data.requests);
        else if (Array.isArray(data)) setDinnerRequests(data);
      })
      .catch(() => {});
  }, [batchId]);

  useEffect(() => {
    if (!isAuthorized || tab !== "meals") return;
    fetchMealsList();
  }, [tab, fetchMealsList, isAuthorized]);

  useEffect(() => {
    if (tab !== "meals" || mealsList.length === 0 || !batchId) return;
    const dates = [...new Set(mealsList.map((m) => new Date(m.date).toISOString().split("T")[0]))];
    const fetchAll = async () => {
      const results: Record<string, AttendanceInfo> = {};
      await Promise.all(
        dates.map(async (date) => {
          try {
            const res = await fetch(`/api/meals/attendance-count?batchId=${batchId}&date=${date}`);
            if (res.ok) results[date] = await res.json();
          } catch { /* ignore */ }
        })
      );
      setMealAttendanceByDate(results);
    };
    fetchAll();
  }, [tab, batchId, mealsList]);

  useEffect(() => {
    if (tab === "meals" && mealDinnerTab === "dinner") fetchDinnerReqs();
  }, [tab, mealDinnerTab, fetchDinnerReqs]);

  // Training/Commuting: batch 로드 시 날짜 초기화
  useEffect(() => {
    if (!batch) return;
    const today = getToday();
    const range = getDateRange(batch.startDate, batch.endDate);
    const defaultDate = range.includes(today) ? today : range[0] || today;
    if (!trainingDate) setTrainingDate(defaultDate);
  }, [batch, trainingDate]);

  // Commuting: batch 로드 시 날짜 초기화
  useEffect(() => {
    if (!batch || commutingDate) return;
    const today = getToday();
    const range = getDateRange(batch.startDate, batch.endDate);
    setCommutingDate(range.includes(today) ? today : range[0] || today);
  }, [batch, commutingDate]);

  // Guard token fetch
  useEffect(() => {
    if (tab !== "commuting" || !batchId) return;
    fetch(`/api/guard-post-tokens?batchId=${batchId}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGuardTokens(data); });
  }, [tab, batchId]);

  // Commuting tab data fetch
  useEffect(() => {
    if (tab !== "commuting" || !batch || !commutingDate) return;

    const fetchCommuting = async () => {
      setCommutingLoading(true);

      const recRes = await fetch(`/api/commuting?batchId=${batchId}&date=${commutingDate}`);
      const existingRecords: CommutingRecord[] = await recRes.json();

      // Fetch attendance for trainings on this date
      const dateTrainings = (batch.trainings || []).filter((t) => {
        const tDate = t.date.split("T")[0];
        return tDate === commutingDate;
      });

      let attendanceMap: Record<string, string> = {};
      if (dateTrainings.length > 0) {
        try {
          const attRes = await fetch(`/api/attendance/${dateTrainings[0].id}`);
          const attData: AttendanceRecord[] = await attRes.json();
          if (Array.isArray(attData)) {
            for (const a of attData) {
              attendanceMap[a.userId] = a.status;
            }
          }
        } catch { /* ignore */ }
      }

      const rows: CommutingRowData[] = (batch.users || []).map((u) => {
        const existing = existingRecords.find((r) => r.userId === u.id);
        return {
          userId: u.id,
          name: u.name,
          rank: u.rank,
          serviceNumber: u.serviceNumber,
          checkIn: existing?.checkInAt
            ? new Date(existing.checkInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
            : "",
          checkOut: existing?.checkOutAt
            ? new Date(existing.checkOutAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
            : "",
          note: existing?.note || "",
          attendanceStatus: attendanceMap[u.id] || "",
          batchStatus: u.batchStatus || "PENDING",
          batchUserId: u.batchUserId || "",
          supplementaryTraining: existing?.supplementaryTraining || false,
        };
      });
      setCommutingRows(rows);
      setCommutingLoading(false);
    };

    fetchCommuting();
  }, [tab, batchId, commutingDate, batch]);

  const updateCommutingRow = (idx: number, field: keyof CommutingRowData, value: string) => {
    setCommutingRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const getNowTime = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  // 개별 출퇴근 즉시 저장
  const saveOneCommuting = async (row: CommutingRowData, checkIn: string, checkOut: string) => {
    const toUtcIso = (time: string) => {
      if (!time) return undefined;
      const d = new Date(`${commutingDate}T${time}:00+09:00`);
      return d.toISOString();
    };
    await fetch("/api/commuting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isManual: true,
        userId: row.userId,
        date: commutingDate,
        checkInAt: toUtcIso(checkIn),
        checkOutAt: toUtcIso(checkOut),
        note: row.note || undefined,
        batchId,
      }),
    });
  };

  // 보충교육 체크 저장
  const saveSupplementaryTraining = async (row: CommutingRowData, checked: boolean) => {
    const toUtcIso = (time: string) => {
      if (!time) return undefined;
      const d = new Date(`${commutingDate}T${time}:00+09:00`);
      return d.toISOString();
    };
    await fetch("/api/commuting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isManual: true,
        userId: row.userId,
        date: commutingDate,
        checkInAt: toUtcIso(row.checkIn),
        checkOutAt: toUtcIso(row.checkOut),
        note: row.note || undefined,
        batchId,
        supplementaryTraining: checked,
      }),
    });
  };

  const handleCheckIn = (idx: number) => {
    const now = getNowTime();
    setCommutingRows((prev) => {
      const updated = prev.map((r, i) => i === idx ? { ...r, checkIn: now } : r);
      saveOneCommuting(updated[idx], now, updated[idx].checkOut);
      return updated;
    });
  };

  const handleCheckOut = (idx: number) => {
    const now = getNowTime();
    setCommutingRows((prev) => {
      const updated = prev.map((r, i) => i === idx ? { ...r, checkOut: now } : r);
      saveOneCommuting(updated[idx], updated[idx].checkIn, now);
      return updated;
    });
  };

  // 불참→참석 전환 후 출근 처리
  const handleSwitchToPresent = async (idx: number) => {
    const row = commutingRows[idx];
    if (!row.batchUserId) return;
    const res = await fetch(`/api/batches/${batchId}/bulk-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchUserIds: [row.batchUserId], status: "PRESENT" }),
    });
    if (res.ok) {
      const now = getNowTime();
      setCommutingRows((prev) => prev.map((r, i) => i === idx ? { ...r, batchStatus: "PRESENT", checkIn: now } : r));
      saveOneCommuting(row, now, row.checkOut);
      fetchBatch(); // 참석신고 현황도 갱신
    } else {
      alert("참석 전환에 실패했습니다.");
    }
  };

  const handleCommutingSave = async () => {
    setCommutingSaving(true);
    const promises = commutingRows
      .filter((row) => row.batchStatus !== "ABSENT" || row.checkIn || row.checkOut)
      .map((row) => {
        // KST 시간을 UTC ISO 문자열로 변환 (9시간 빼기)
        const toUtcIso = (time: string) => {
          if (!time) return undefined;
          const d = new Date(`${commutingDate}T${time}:00+09:00`);
          return d.toISOString();
        };

        return fetch("/api/commuting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isManual: true,
            userId: row.userId,
            date: commutingDate,
            checkInAt: toUtcIso(row.checkIn),
            checkOutAt: toUtcIso(row.checkOut),
            note: row.note || undefined,
            batchId,
          }),
        });
      });

    await Promise.all(promises);
    setCommutingSaving(false);
    alert("저장 완료되었습니다.");
  };

  // Initialize settings form when batch loads or modal opens
  useEffect(() => {
    if (batch && showSettingsModal) {
      setSettingsForm({
        name: batch.name,
        year: batch.year,
        number: batch.number,
        startDate: batch.startDate.split("T")[0],
        endDate: batch.endDate.split("T")[0],
        location: batch.location || "",
        requiredHours: batch.requiredHours != null ? String(batch.requiredHours) : "",
      });
    }
  }, [batch, showSettingsModal]);

  // Settlement tab data fetch
  useEffect(() => {
    if (tab !== "settlement" || !batchId) return;
    setSettlementLoading(true);
    fetch(`/api/batches/${batchId}/settlement`)
      .then((r) => r.json())
      .then((data) => {
        setSettlementRows(data.rows || []);
        setSettlementRequiredHours(data.requiredHours);
        setSettlementStartDate(data.startDate || "");
      })
      .finally(() => setSettlementLoading(false));
  }, [tab, batchId]);

  const handleSettlementSave = async () => {
    setSettlementSaving(true);
    const res = await fetch(`/api/batches/${batchId}/settlement`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: settlementRows.map((r) => ({
          batchUserId: r.batchUserId,
          completedHours: r.completedHours,
        })),
      }),
    });
    setSettlementSaving(false);
    if (res.ok) alert("저장되었습니다.");
    else alert("저장에 실패했습니다.");
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    const res = await fetch(`/api/batches/${batchId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: settingsForm.name,
        year: settingsForm.year,
        number: settingsForm.number,
        startDate: settingsForm.startDate,
        endDate: settingsForm.endDate,
        location: settingsForm.location || null,
        requiredHours: settingsForm.requiredHours,
      }),
    });
    setSettingsSaving(false);
    if (res.ok) {
      alert("저장되었습니다.");
      fetchBatch();
    } else {
      alert("저장에 실패했습니다.");
    }
  };

  const handleAddTraining = (date: string) => {
    setTrainingFormDate(date);
    setTrainingForm({ title: "", type: "기타", startTime: "", endTime: "", location: "", description: "", instructorId: "", attendanceEnabled: true, countsTowardHours: true });
    setShowTrainingForm(true);
  };

  const handleCreateTraining = async () => {
    const res = await fetch("/api/trainings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...trainingForm,
        date: trainingFormDate,
        batchId,
        instructorId: trainingForm.instructorId || null,
      }),
    });
    if (res.ok) {
      setShowTrainingForm(false);
      fetchBatch();
    }
  };

  const handleDeleteTraining = async (trainingId: string) => {
    if (!confirm("훈련을 삭제하시겠습니까?")) return;
    await fetch(`/api/trainings/${trainingId}`, { method: "DELETE" });
    fetchBatch();
  };

  // Edit training
  const handleEditTraining = (training: Training) => {
    setEditingTraining(training);
    setEditForm({
      title: training.title,
      type: training.type,
      startTime: training.startTime || "",
      endTime: training.endTime || "",
      location: training.location || "",
      description: training.description || "",
      instructorId: training.instructor?.id || "",
      attendanceEnabled: training.attendanceEnabled,
      countsTowardHours: training.countsTowardHours,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTraining) return;
    const res = await fetch(`/api/trainings/${editingTraining.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        instructorId: editForm.instructorId || null,
      }),
    });
    if (res.ok) {
      setEditingTraining(null);
      fetchBatch();
    }
  };

  // Single assignment
  const handleAssign = async (userId: string) => {
    const res = await fetch(`/api/batches/${batchId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] }),
    });
    if (res.ok) {
      fetchBatch();
      fetchUnassigned();
      setSelectedUnassigned((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  };

  const handleUnassign = async (userId: string) => {
    const res = await fetch(`/api/batches/${batchId}/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: [userId] }),
    });
    if (res.ok) {
      fetchBatch();
      fetchUnassigned();
      setSelectedAssigned((prev) => { const next = new Set(prev); next.delete(userId); return next; });
    }
  };

  // Bulk assignment
  const handleBulkAssign = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    setBulkLoading(true);
    const res = await fetch(`/api/batches/${batchId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    if (res.ok) {
      fetchBatch();
      fetchUnassigned();
      setSelectedUnassigned(new Set());
    }
    setBulkLoading(false);
  };

  const handleBulkUnassign = async (userIds: string[]) => {
    if (userIds.length === 0) return;
    setBulkLoading(true);
    const res = await fetch(`/api/batches/${batchId}/unassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds }),
    });
    if (res.ok) {
      fetchBatch();
      fetchUnassigned();
      setSelectedAssigned(new Set());
    }
    setBulkLoading(false);
  };

  useEffect(() => {
    if (status === "authenticated" && !["ADMIN", "MANAGER"].includes(session?.user?.role ?? "")) {
      router.replace("/batches");
    }
  }, [session, status, router]);

  if (status === "loading" || !isAuthorized) {
    return <div className="text-center py-8 text-gray-400">로딩 중...</div>;
  }

  if (!batch) return <div className="text-center py-8 text-gray-400">로딩 중...</div>;

  const dateRange = getDateRange(batch.startDate, batch.endDate);
  const trainingsByDate: Record<string, Training[]> = {};
  for (const d of dateRange) trainingsByDate[d] = [];
  for (const t of batch.trainings) {
    const dateKey = t.date.split("T")[0];
    if (trainingsByDate[dateKey]) trainingsByDate[dateKey].push(t);
    else trainingsByDate[dateKey] = [t];
  }
  // 각 날짜 내 훈련을 시간순 정렬
  for (const d of Object.keys(trainingsByDate)) {
    trainingsByDate[d].sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }

  // Group unassigned users by unit
  const filteredUnassigned = unassigned.filter((u) =>
    searchTerm === "" || u.name.includes(searchTerm) || u.serviceNumber?.includes(searchTerm) || u.unit?.includes(searchTerm)
  );
  const groupedUnassigned: Record<string, UnassignedUser[]> = {};
  for (const u of filteredUnassigned) {
    const key = u.unit || "미지정";
    if (!groupedUnassigned[key]) groupedUnassigned[key] = [];
    groupedUnassigned[key].push(u);
  }

  const toggleUnassignedSelect = (id: string) => {
    setSelectedUnassigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAssignedSelect = (id: string) => {
    setSelectedAssigned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <PageTitle
        title={batch.name}
        description={(() => {
          const s = new Date(batch.startDate);
          const e = new Date(batch.endDate);
          const days = ["일", "월", "화", "수", "목", "금", "토"];
          const fmt = (d: Date) => `${String(d.getFullYear()).slice(2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${days[d.getDay()]})`;
          const isSameDay = s.toDateString() === e.toDateString();
          if (isSameDay) return `${batch._count.users}명 | ${fmt(s)}`;
          const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
          if (sameMonth) return `${batch._count.users}명 | ${fmt(s)} ~ ${e.getDate()}일(${days[e.getDay()]})`;
          return `${batch._count.users}명 | ${fmt(s)} ~ ${fmt(e)}`;
        })()}
        actions={
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[batch.status] || "bg-gray-100"}`}>
              {BATCH_STATUS_LABELS[batch.status] || batch.status}
            </span>
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="차수 설정"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        }
      />

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 bg-gray-50/80 p-1 rounded-lg overflow-x-auto scrollbar-hide">
        {([
          { key: "training" as const, icon: "\uD83C\uDFCB", label: "훈련" },
          { key: "trainees" as const, icon: "\uD83D\uDC65", label: "대상자" },
          { key: "attendance" as const, icon: "\uD83D\uDCCB", label: "참석" },
          { key: "trainingAttendance" as const, icon: "\u2705", label: "출석" },
          { key: "meals" as const, icon: "\uD83C\uDF5A", label: "식사" },
          { key: "commuting" as const, icon: "\uD83D\uDD50", label: "출퇴근" },
          { key: "survey" as const, icon: "\uD83D\uDCDD", label: "설문" },
          { key: "settlement" as const, icon: "\uD83D\uDCB0", label: "결산" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${tab === t.key ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-800 hover:bg-white/50"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Training Plan Tab */}
      {tab === "training" && (
        <div className="space-y-4">
          {/* 차수 날짜 선택 — 2일 이상일 때만 표시 */}
          {dateRange.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              {dateRange.map((d) => {
                const dt = new Date(d);
                const label = dt.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
                const isSelected = trainingDate === d;
                const hasTraining = (trainingsByDate[d] || []).length > 0;
                return (
                  <button
                    key={d}
                    onClick={() => setTrainingDate(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : hasTraining
                          ? "bg-blue-50 text-blue-700 hover:bg-blue-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 선택된 날짜 훈련 내용 */}
          {(() => {
            const dayTrainings = trainingsByDate[trainingDate] || [];
            return (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-semibold text-sm">
                    {dateRange.length === 1
                      ? new Date(trainingDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })
                      : `훈련 ${dayTrainings.length}개`
                    }
                  </h3>
                  <button
                    onClick={() => handleAddTraining(trainingDate)}
                    className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    + 추가
                  </button>
                </div>
                {dayTrainings.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs border-b">
                        <th className="px-4 py-2 font-medium">시간</th>
                        <th className="px-4 py-2 font-medium">소요시간</th>
                        <th className="px-4 py-2 font-medium">훈련내용</th>
                        <th className="px-4 py-2 font-medium">장소</th>
                        <th className="px-4 py-2 font-medium">교관</th>
                        <th className="px-4 py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {dayTrainings.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 whitespace-nowrap">{t.startTime || "-"} ~ {t.endTime || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-500">{computeDuration(t.startTime, t.endTime)}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{t.title}</span>
                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">{t.type}</span>
                            {!t.attendanceEnabled && <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">출석부 OFF</span>}
                            {!t.countsTowardHours && <span className="ml-1 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded">이수제외</span>}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{t.location || "-"}</td>
                          <td className="px-4 py-2.5 text-gray-500">{t.instructor?.name || "-"}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditTraining(t)}
                                className="text-blue-500 hover:text-blue-700 text-xs"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDeleteTraining(t.id)}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="px-4 py-3 text-sm text-gray-400">등록된 훈련이 없습니다.</p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Trainees Tab */}
      {tab === "trainees" && (
        <div className="space-y-4">
          {/* Assigned panel (위) */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-blue-50 border-b">
              <h3 className="font-semibold text-sm text-blue-700">배정된 대상자 ({batch.users.length}명)</h3>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleBulkUnassign(batch.users.map((u) => u.id))}
                  disabled={bulkLoading || batch.users.length === 0}
                  className="px-2.5 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  전체 해제 ({batch.users.length})
                </button>
                {selectedAssigned.size > 0 && (
                  <button
                    onClick={() => handleBulkUnassign(Array.from(selectedAssigned))}
                    disabled={bulkLoading}
                    className="px-2.5 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                  >
                    선택 해제 ({selectedAssigned.size})
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {batch.users.length > 0 ? (
                batch.users.map((u) => (
                  <div
                    key={u.id}
                    className="w-full text-left px-4 py-2.5 border-b hover:bg-red-50 transition-colors flex items-center justify-between"
                  >
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAssigned.has(u.id)}
                        onChange={() => toggleAssignedSelect(u.id)}
                        className="rounded"
                      />
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{u.name}</span>
                        <span className="text-xs text-gray-500">{u.rank} | {u.serviceNumber}</span>
                        {u.unit && <span className="text-xs text-gray-400">{u.unit}</span>}
                        {u.batchStatus && (
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                            u.batchStatus === "PRESENT" ? "bg-green-100 text-green-700" :
                            u.batchStatus === "ABSENT" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {u.batchStatus === "PRESENT" ? "참석" : u.batchStatus === "ABSENT" ? "불참" : "미정"}
                          </span>
                        )}
                      </div>
                    </label>
                    <button
                      onClick={() => handleUnassign(u.id)}
                      className="text-red-500 text-xs hover:text-red-700"
                    >
                      &larr; 해제
                    </button>
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">배정된 대상자가 없습니다.</p>
              )}
            </div>
          </div>

          {/* Unassigned panel (아래) */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-semibold text-sm mb-2">미배정 대상자</h3>
              <input
                type="text"
                placeholder="이름, 군번, 부대로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-sm"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleBulkAssign(filteredUnassigned.map((u) => u.id))}
                  disabled={bulkLoading || filteredUnassigned.length === 0}
                  className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  전체 배정 ({filteredUnassigned.length})
                </button>
                {selectedUnassigned.size > 0 && (
                  <button
                    onClick={() => handleBulkAssign(Array.from(selectedUnassigned))}
                    disabled={bulkLoading}
                    className="px-2.5 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    선택 배정 ({selectedUnassigned.size})
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {Object.keys(groupedUnassigned).length > 0 ? (
                Object.entries(groupedUnassigned).map(([unit, users]) => (
                  <div key={unit}>
                    <div className="px-4 py-1.5 bg-gray-50 text-xs text-gray-500 font-medium border-b">{unit}</div>
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="w-full text-left px-4 py-2.5 border-b hover:bg-blue-50 transition-colors flex items-center justify-between"
                      >
                        <label className="flex items-center gap-2 flex-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedUnassigned.has(u.id)}
                            onChange={() => toggleUnassignedSelect(u.id)}
                            className="rounded"
                          />
                          <div>
                            <span className="font-medium text-sm">{u.name}</span>
                            <span className="ml-2 text-xs text-gray-500">{u.rank} | {u.serviceNumber}</span>
                          </div>
                        </label>
                        <button
                          onClick={() => handleAssign(u.id)}
                          className="text-blue-500 text-xs hover:text-blue-700"
                        >
                          배정 &rarr;
                        </button>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">미배정 대상자가 없습니다.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Attendance Summary Tab */}
      {tab === "attendance" && (
        <div className="space-y-6">
          {/* 참석신고 현황 (대상자별 자기신고) */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">참석신고 현황</h3>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600">참석 {batch.users.filter((u) => u.batchStatus === "PRESENT").length}</span>
                  <span className="text-red-600">불참 {batch.users.filter((u) => u.batchStatus === "ABSENT").length}</span>
                  <span className="text-yellow-600">미정 {batch.users.filter((u) => !u.batchStatus || u.batchStatus === "PENDING").length}</span>
                </div>
              </div>
              <div className="flex gap-1.5 items-center">
                {([["ALL", "전체"], ["PRESENT", "참석"], ["ABSENT", "불참"], ["PENDING", "미정"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setAttendanceFilter(key)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      attendanceFilter === key
                        ? key === "PRESENT" ? "bg-green-600 text-white"
                        : key === "ABSENT" ? "bg-red-600 text-white"
                        : key === "PENDING" ? "bg-yellow-500 text-white"
                        : "bg-gray-700 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {batch.users.filter((u) => !u.batchStatus || u.batchStatus === "PENDING").length > 0 && (
                  <button
                    onClick={async () => {
                      const pendingUsers = batch.users.filter((u) => !u.batchStatus || u.batchStatus === "PENDING");
                      if (!confirm(`미정 상태인 ${pendingUsers.length}명을 일괄 불참 처리하시겠습니까?`)) return;
                      const batchUserIds = pendingUsers.map((u) => u.batchUserId).filter(Boolean);
                      const res = await fetch(`/api/batches/${batchId}/bulk-status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ batchUserIds, status: "ABSENT" }),
                      });
                      if (res.ok) fetchBatch();
                      else alert("처리에 실패했습니다.");
                    }}
                    className="ml-2 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                  >
                    일괄 불참 처리
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y">
              {batch.users.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">배정된 대상자가 없습니다.</p>
              ) : (
                batch.users
                .filter((u) => {
                  if (attendanceFilter === "ALL") return true;
                  if (attendanceFilter === "PENDING") return !u.batchStatus || u.batchStatus === "PENDING";
                  return u.batchStatus === attendanceFilter;
                })
                .map((u) => {
                  const userReports = reasonReports.filter((r) => r.batchUserId === u.batchUserId);
                  return (
                    <div key={u.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm shrink-0">
                          <span className="text-gray-500">{u.rank}</span> {u.name}
                        </span>
                        {(u.warBattalion || u.warCompany || u.warPlatoon || u.position) && (
                          <span className="text-xs text-gray-400 truncate" title={[u.warBattalion, u.warCompany, u.warPlatoon, u.position].filter(Boolean).join(" / ")}>
                            {[u.warBattalion, u.warCompany, u.warPlatoon, u.position].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {u.batchReason && u.batchStatus === "ABSENT" && (
                          <span className="text-xs text-gray-400 max-w-[150px] truncate" title={u.batchReason}>{u.batchReason}</span>
                        )}
                        {u.batchSubStatus && u.batchSubStatus !== "NORMAL" && (
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            u.batchSubStatus === "LATE_ARRIVAL" ? "bg-yellow-50 text-yellow-600" : "bg-orange-50 text-orange-600"
                          }`}>
                            {SUB_STATUS_LABELS[u.batchSubStatus]}
                          </span>
                        )}
                        {(() => {
                          const hq = healthQuestionnaires.find((h) => h.batchUserId === u.batchUserId);
                          return hq ? (
                            <button
                              onClick={() => setViewingHealth(hq)}
                              className="px-1.5 py-0.5 text-xs bg-teal-50 text-teal-600 rounded hover:bg-teal-100"
                              title="문진표 보기"
                            >
                              문진표
                            </button>
                          ) : u.batchStatus === "PRESENT" ? (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-50 text-gray-400 rounded">문진표 미제출</span>
                          ) : null;
                        })()}
                        {userReports.length > 0 && (
                          <button
                            onClick={() => setViewingReport(userReports[0])}
                            className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            title="사유서 보기"
                          >
                            사유서 ({userReports.length})
                          </button>
                        )}
                        <div className="flex items-center gap-0.5">
                          {(["PRESENT", "ABSENT", "PENDING"] as const).map((st) => {
                            const isActive = st === "PRESENT" ? u.batchStatus === "PRESENT"
                              : st === "ABSENT" ? u.batchStatus === "ABSENT"
                              : !u.batchStatus || u.batchStatus === "PENDING";
                            const labels = { PRESENT: "참석", ABSENT: "불참", PENDING: "미정" };
                            const activeColors = {
                              PRESENT: "bg-green-600 text-white",
                              ABSENT: "bg-red-600 text-white",
                              PENDING: "bg-yellow-500 text-white",
                            };
                            return (
                              <button
                                key={st}
                                onClick={async () => {
                                  if (isActive) return;
                                  if (!u.batchUserId) return;
                                  const res = await fetch(`/api/batches/${batchId}/bulk-status`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ batchUserIds: [u.batchUserId], status: st }),
                                  });
                                  if (res.ok) fetchBatch();
                                  else alert("상태 변경에 실패했습니다.");
                                }}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                  isActive ? activeColors[st] : "bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                                }`}
                              >
                                {labels[st]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {batch.users.length > 0 && batch.users.filter((u) => {
                if (attendanceFilter === "ALL") return true;
                if (attendanceFilter === "PENDING") return !u.batchStatus || u.batchStatus === "PENDING";
                return u.batchStatus === attendanceFilter;
              }).length === 0 && (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">해당 상태의 대상자가 없습니다.</p>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Training Attendance Tab */}
      {tab === "trainingAttendance" && (
        <div>
          <h3 className="font-semibold text-sm mb-3 px-1">훈련별 출석 현황</h3>
          {attendanceLoading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : (
            <div className="space-y-3">
              {batch.trainings.length === 0 && (
                <p className="text-center py-8 text-gray-400">등록된 훈련이 없습니다.</p>
              )}
              {[...batch.trainings]
                .sort((a, b) => {
                  const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
                  if (dateCompare !== 0) return dateCompare;
                  return (a.startTime || "").localeCompare(b.startTime || "");
                })
                .map((t) => {
                const summary = attendanceSummary?.byTraining.find((s) => s.trainingId === t.id);
                return (
                  <div
                    key={t.id}
                    onClick={() => router.push(`/attendance/${t.id}`)}
                    className="bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{t.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(t.date).toLocaleDateString("ko-KR")}
                          {t.startTime && t.endTime ? ` ${t.startTime}~${t.endTime}` : ""}
                          {t.location ? ` | ${t.location}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t.type}</span>
                          {!t.attendanceEnabled && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs">출석부 OFF</span>
                          )}
                          {!t.countsTowardHours && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">이수제외</span>
                          )}
                        </div>
                        {summary && (
                          <div className="flex gap-2 mt-1 text-xs">
                            <span className="text-green-600">참석 {summary.present}</span>
                            <span className="text-red-600">불참 {summary.absent}</span>
                            <span className="text-yellow-600">미정 {summary.pending}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Commuting Tab */}
      {tab === "commuting" && (
        <div className="space-y-4">
          {/* 위병소 근무자용 링크 관리 */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">위병소 근무자용 링크</h3>
              <button
                onClick={() => setShowTokenForm(!showTokenForm)}
                className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                + 새 링크
              </button>
            </div>
            <div className="p-4 space-y-3">
              {showTokenForm && (
                <div className="space-y-3 bg-gray-50 rounded-lg p-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">링크 이름 (선택)</label>
                    <input
                      value={tokenLabel}
                      onChange={(e) => setTokenLabel(e.target.value)}
                      placeholder="예: 정문 위병소"
                      className="w-full px-3 py-1.5 border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">유효기간</label>
                    <div className="flex gap-2 flex-wrap">
                      {([
                        { value: "batch" as const, label: "차수 종료일" },
                        { value: "custom" as const, label: "직접 지정" },
                        { value: "none" as const, label: "무기한" },
                      ]).map((opt) => (
                        <label key={opt.value} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs ${tokenExpiryType === opt.value ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:bg-gray-100"}`}>
                          <input type="radio" name="tokenExpiry" value={opt.value} checked={tokenExpiryType === opt.value} onChange={() => setTokenExpiryType(opt.value)} className="sr-only" />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                    {tokenExpiryType === "custom" && (
                      <input
                        type="datetime-local"
                        value={tokenExpiryDate}
                        onChange={(e) => setTokenExpiryDate(e.target.value)}
                        className="mt-2 w-full px-3 py-1.5 border rounded-lg text-sm"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const body: Record<string, unknown> = { batchId, label: tokenLabel || null };
                        if (tokenExpiryType === "none") {
                          body.noExpiry = true;
                        } else if (tokenExpiryType === "custom" && tokenExpiryDate) {
                          body.expiresAt = new Date(tokenExpiryDate).toISOString();
                        }
                        const res = await fetch("/api/guard-post-tokens", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        if (res.ok) {
                          const newToken = await res.json();
                          setGuardTokens((prev) => [newToken, ...prev]);
                          setTokenLabel("");
                          setTokenExpiryType("batch");
                          setTokenExpiryDate("");
                          setShowTokenForm(false);
                        }
                      }}
                      className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                    >
                      생성
                    </button>
                    <button
                      onClick={() => setShowTokenForm(false)}
                      className="px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {guardTokens.length === 0 && !showTokenForm && (
                <p className="text-center py-3 text-xs text-gray-400">
                  생성된 링크가 없습니다. 위병소 근무자에게 공유할 링크를 생성하세요.
                </p>
              )}

              {guardTokens.map((gt) => {
                const url = `${typeof window !== "undefined" ? window.location.origin : ""}/guard-post/${gt.token}`;
                return (
                  <div key={gt.id} className={`p-3 rounded-lg border ${gt.isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200 opacity-60"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{gt.label || "공유 링크"}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${gt.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                          {gt.isActive ? "활성" : "비활성"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(url);
                            alert("링크가 복사되었습니다.");
                          }}
                          className="px-2 py-0.5 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50"
                        >
                          복사
                        </button>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/guard-post-tokens/${gt.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isActive: !gt.isActive }),
                            });
                            if (res.ok) {
                              setGuardTokens((prev) => prev.map((t) => t.id === gt.id ? { ...t, isActive: !t.isActive } : t));
                            }
                          }}
                          className={`px-2 py-0.5 text-xs rounded ${gt.isActive ? "text-orange-600 border border-orange-200 hover:bg-orange-50" : "text-green-600 border border-green-200 hover:bg-green-50"}`}
                        >
                          {gt.isActive ? "비활성화" : "활성화"}
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("이 링크를 삭제하시겠습니까?")) return;
                            await fetch(`/api/guard-post-tokens/${gt.id}`, { method: "DELETE" });
                            setGuardTokens((prev) => prev.filter((t) => t.id !== gt.id));
                          }}
                          className="px-2 py-0.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 break-all">{url}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {gt.expiresAt
                        ? `만료: ${new Date(gt.expiresAt).toLocaleString("ko-KR", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                        : "만료: 무기한"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 차수 날짜 선택 — 2일 이상일 때만 표시 */}
          {dateRange.length > 1 && (
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {dateRange.map((d) => {
                const dt = new Date(d);
                const label = dt.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
                const isSelected = commutingDate === d;
                return (
                  <button
                    key={d}
                    onClick={() => setCommutingDate(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {commutingLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* 인원 현황 통계 카드 */}
              {commutingRows.length > 0 && (() => {
                const rows = commutingRows.filter((r) => r.serviceNumber !== TEST_SN);
                const total = rows.length;
                const presentCount = rows.filter((r) => r.batchStatus === "PRESENT").length;
                const pendingCount = rows.filter((r) => r.batchStatus === "PENDING").length;
                const absentCount = rows.filter((r) => r.batchStatus === "ABSENT").length;
                const checkedInCount = rows.filter((r) => r.batchStatus !== "ABSENT" && r.checkIn).length;
                const lateArrivalCount = rows.filter((r) => {
                  if (!r.checkIn || r.batchStatus === "ABSENT") return false;
                  const [hh, mm] = r.checkIn.split(":").map(Number);
                  return hh > 8 || (hh === 8 && mm > 30);
                }).length;
                const earlyOutCount = rows.filter((r) => {
                  if (!r.checkOut) return false;
                  const [hh, mm] = r.checkOut.split(":").map(Number);
                  return hh < 17 || (hh === 17 && mm < 30);
                }).length;
                const checkedOutCount = rows.filter((r) => {
                  if (!r.checkOut) return false;
                  const [hh, mm] = r.checkOut.split(":").map(Number);
                  return hh > 17 || (hh === 17 && mm >= 30);
                }).length;
                const stats = [
                  { label: "총원", value: total, color: "bg-gray-100 text-gray-800" },
                  { label: "참석", value: presentCount, color: "bg-green-50 text-green-700" },
                  { label: "미정", value: pendingCount, color: "bg-yellow-50 text-yellow-700" },
                  { label: "불참", value: absentCount, color: "bg-red-50 text-red-700" },
                ];
                const commStats = [
                  { label: "입소(출근)", value: checkedInCount, color: "bg-blue-50 text-blue-700" },
                  { label: "지연입소", value: lateArrivalCount, color: "bg-amber-50 text-amber-700", sub: "08:30 이후" },
                  { label: "조기퇴소", value: earlyOutCount, color: "bg-orange-50 text-orange-700", sub: "17:30 이전" },
                  { label: "퇴소(퇴근)", value: checkedOutCount, color: "bg-purple-50 text-purple-700", sub: "17:30 이후" },
                ];
                return (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {stats.map((s) => (
                      <div key={s.label} className={`${s.color} rounded-xl px-3 py-2.5 text-center`}>
                        <div className="text-[10px] font-medium opacity-70">{s.label}</div>
                        <div className="text-lg font-bold">{s.value}</div>
                      </div>
                    ))}
                    {commStats.map((s) => (
                      <div key={s.label} className={`${s.color} rounded-xl px-3 py-2.5 text-center`}>
                        <div className="text-[10px] font-medium opacity-70">{s.label}</div>
                        <div className="text-lg font-bold">{s.value}</div>
                        {s.sub && <div className="text-[9px] opacity-50">{s.sub}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* 일괄 출근/퇴근 + 보고 버튼 */}
              {commutingRows.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => {
                      const now = getNowTime();
                      setCommutingRows((prev) => prev.map((row) =>
                        row.batchStatus === "ABSENT" || row.checkIn ? row : { ...row, checkIn: now }
                      ));
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                  >
                    일괄 출근
                  </button>
                  <button
                    onClick={() => { setReportType("checkin"); setReportCopied(false); }}
                    className="px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50"
                  >
                    출근 보고
                  </button>
                  <button
                    onClick={() => {
                      const now = getNowTime();
                      setCommutingRows((prev) => prev.map((row) =>
                        row.batchStatus === "ABSENT" || row.checkOut ? row : { ...row, checkOut: now }
                      ));
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700"
                  >
                    일괄 퇴근
                  </button>
                  <button
                    onClick={() => { setReportType("checkout"); setReportCopied(false); }}
                    className="px-4 py-2 border border-orange-600 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-50"
                  >
                    퇴근 보고
                  </button>
                </div>
              )}

              {/* Desktop: 테이블 */}
              <div className="hidden lg:block bg-white rounded-xl border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">대상자</th>
                      <th className="text-left px-4 py-3 font-medium w-20">참석</th>
                      <th className="text-left px-4 py-3 font-medium w-36">출근시간</th>
                      <th className="text-left px-4 py-3 font-medium w-36">퇴근시간</th>
                      <th className="text-left px-4 py-3 font-medium">비고</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {commutingRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-400">배정된 대상자가 없습니다.</td>
                      </tr>
                    )}
                    {commutingRows.map((row, idx) => {
                      const isAbsent = row.batchStatus === "ABSENT";
                      const isPending = row.batchStatus === "PENDING";
                      const isLateArrival = (() => {
                        if (!row.checkIn || isAbsent) return false;
                        const [hh, mm] = row.checkIn.split(":").map(Number);
                        return hh > 8 || (hh === 8 && mm > 30);
                      })();
                      return (
                        <tr
                          key={row.userId}
                          className={`${isAbsent ? "bg-red-50/60" : isPending ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <span><span className="text-gray-500">{row.rank}</span> {row.name}</span>
                              {isLateArrival && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">지연</span>
                              )}
                            </div>
                            <span className="text-xs text-gray-400">{row.serviceNumber}</span>
                          </td>
                          <td className="px-4 py-2">
                            {isAbsent ? (
                              <button
                                onClick={() => handleSwitchToPresent(idx)}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                              >
                                참석 전환
                              </button>
                            ) : (
                              <span className={`text-xs font-medium ${
                                row.batchStatus === "PRESENT" ? "text-green-600" : "text-yellow-600"
                              }`}>
                                {row.batchStatus === "PRESENT" ? "참석" : "미정"}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 items-center">
                              <button
                                onClick={() => !isAbsent && setTimePickerTarget({ idx, field: "checkIn" })}
                                disabled={isAbsent}
                                className={`px-3 py-1.5 border rounded text-sm min-w-[70px] text-left disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                  row.checkIn ? "text-green-700 font-medium border-green-300 bg-green-50" : "text-gray-400"
                                }`}
                              >
                                {row.checkIn || "--:--"}
                              </button>
                              <button
                                onClick={() => handleCheckIn(idx)}
                                disabled={isAbsent}
                                className="px-2 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                              >
                                출근
                              </button>
                              {row.checkIn && !isAbsent && (
                                <button
                                  onClick={() => updateCommutingRow(idx, "checkIn", "")}
                                  className="px-1.5 py-1 text-gray-400 hover:text-red-500 text-xs shrink-0"
                                  title="출근 기록 삭제"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 items-center">
                              <button
                                onClick={() => !isAbsent && setTimePickerTarget({ idx, field: "checkOut" })}
                                disabled={isAbsent}
                                className={`px-3 py-1.5 border rounded text-sm min-w-[70px] text-left disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                  row.checkOut ? "text-orange-700 font-medium border-orange-300 bg-orange-50" : "text-gray-400"
                                }`}
                              >
                                {row.checkOut || "--:--"}
                              </button>
                              <button
                                onClick={() => handleCheckOut(idx)}
                                disabled={isAbsent}
                                className="px-2 py-1.5 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                              >
                                퇴근
                              </button>
                              {row.checkOut && !isAbsent && (
                                <button
                                  onClick={() => updateCommutingRow(idx, "checkOut", "")}
                                  className="px-1.5 py-1 text-gray-400 hover:text-red-500 text-xs shrink-0"
                                  title="퇴근 기록 삭제"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <input
                              value={row.note}
                              onChange={(e) => updateCommutingRow(idx, "note", e.target.value)}
                              placeholder="비고"
                              disabled={isAbsent}
                              className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
                            {isLateArrival && (
                              <label className="flex items-center gap-1 mt-1 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={row.supplementaryTraining}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setCommutingRows((prev) =>
                                      prev.map((r, i) => i === idx ? { ...r, supplementaryTraining: checked } : r)
                                    );
                                    saveSupplementaryTraining(row, checked);
                                  }}
                                  className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-[10px] text-amber-700 font-medium">보충교육</span>
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: 카드 리스트 */}
              <div className="lg:hidden space-y-3">
                {commutingRows.length === 0 && (
                  <p className="text-center py-8 text-gray-400">배정된 대상자가 없습니다.</p>
                )}
                {commutingRows.map((row, idx) => {
                  const isAbsent = row.batchStatus === "ABSENT";
                  const isLateArrivalMobile = (() => {
                    if (!row.checkIn || isAbsent) return false;
                    const [hh, mm] = row.checkIn.split(":").map(Number);
                    return hh > 8 || (hh === 8 && mm > 30);
                  })();
                  return (
                    <div
                      key={row.userId}
                      className={`rounded-xl border p-4 ${isAbsent ? "bg-red-50/60" : "bg-white"}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium text-sm flex items-center gap-1.5">
                          <span><span className="text-gray-500">{row.rank}</span> {row.name}</span>
                          {isLateArrivalMobile && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded">지연</span>
                          )}
                        </div>
                        {isAbsent ? (
                          <button
                            onClick={() => handleSwitchToPresent(idx)}
                            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700"
                          >
                            참석 전환
                          </button>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.batchStatus === "PRESENT" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                          }`}>
                            {row.batchStatus === "PRESENT" ? "참석" : "미정"}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">출근시간</label>
                          <div className="flex gap-1">
                            <button
                              onClick={() => !isAbsent && setTimePickerTarget({ idx, field: "checkIn" })}
                              disabled={isAbsent}
                              className={`flex-1 px-2 py-1.5 border rounded text-sm text-left disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                row.checkIn ? "text-green-700 font-medium border-green-300 bg-green-50" : "text-gray-400"
                              }`}
                            >
                              {row.checkIn || "--:--"}
                            </button>
                            <button
                              onClick={() => handleCheckIn(idx)}
                              disabled={isAbsent}
                              className="px-2.5 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                            >
                              출근
                            </button>
                            {row.checkIn && !isAbsent && (
                              <button
                                onClick={() => updateCommutingRow(idx, "checkIn", "")}
                                className="px-1.5 py-1.5 text-gray-400 hover:text-red-500 text-xs shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">퇴근시간</label>
                          <div className="flex gap-1">
                            <button
                              onClick={() => !isAbsent && setTimePickerTarget({ idx, field: "checkOut" })}
                              disabled={isAbsent}
                              className={`flex-1 px-2 py-1.5 border rounded text-sm text-left disabled:bg-gray-100 disabled:cursor-not-allowed ${
                                row.checkOut ? "text-orange-700 font-medium border-orange-300 bg-orange-50" : "text-gray-400"
                              }`}
                            >
                              {row.checkOut || "--:--"}
                            </button>
                            <button
                              onClick={() => handleCheckOut(idx)}
                              disabled={isAbsent}
                              className="px-2.5 py-1.5 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                            >
                              퇴근
                            </button>
                            {row.checkOut && !isAbsent && (
                              <button
                                onClick={() => updateCommutingRow(idx, "checkOut", "")}
                                className="px-1.5 py-1.5 text-gray-400 hover:text-red-500 text-xs shrink-0"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <input
                        value={row.note}
                        onChange={(e) => updateCommutingRow(idx, "note", e.target.value)}
                        placeholder="비고"
                        disabled={isAbsent}
                        className="w-full px-2 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                      {isLateArrivalMobile && (
                        <label className="flex items-center gap-1.5 mt-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.supplementaryTraining}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCommutingRows((prev) =>
                                prev.map((r, i) => i === idx ? { ...r, supplementaryTraining: checked } : r)
                              );
                              saveSupplementaryTraining(row, checked);
                            }}
                            className="w-4 h-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-xs text-amber-700 font-medium">보충교육 이수</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {commutingRows.length > 0 && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleCommutingSave}
                    disabled={commutingSaving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {commutingSaving ? "저장 중..." : "일괄 저장"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Survey Tab */}
      {tab === "survey" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">차수 설문조사</h3>
            <button
              onClick={() => {
                setSurveyForm({ title: "", description: "", questions: [{ q: "", type: "text", options: [], required: true }] });
                setEditingSurvey(null);
                setShowSurveyForm(true);
              }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + 설문 생성
            </button>
          </div>

          {surveys.length === 0 ? (
            <div className="text-center py-12 text-gray-400">등록된 설문이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {surveys.map((s) => (
                <div key={s.id} className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900">{s.title}</h4>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {s.isActive ? "진행중" : "종료"}
                        </span>
                      </div>
                      {s.description && <p className="text-sm text-gray-500 mt-1">{s.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {JSON.parse(s.questions).length}개 질문 | {s._count.responses}명 응답 | {new Date(s.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <button
                        onClick={() => {
                          const questions = JSON.parse(s.questions);
                          setSurveyForm({ title: s.title, description: s.description || "", questions });
                          setEditingSurvey(s);
                          setShowSurveyForm(true);
                        }}
                        className="px-3 py-1.5 text-sm border rounded-lg text-gray-700 hover:bg-gray-50"
                      >
                        수정
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm(`"${s.title}" 설문을 삭제하시겠습니까?\n응답 데이터도 함께 삭제됩니다.`)) return;
                          const res = await fetch(`/api/surveys/${s.id}`, { method: "DELETE" });
                          if (res.ok) fetchSurveys();
                        }}
                        className="px-3 py-1.5 text-sm border border-red-200 rounded-lg text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Survey create/edit modal */}
      {showSurveyForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">{editingSurvey ? "설문 수정" : "설문 생성"}</h3>
            <div>
              <label className="block text-sm font-medium mb-1">제목</label>
              <input
                value={surveyForm.title}
                onChange={(e) => setSurveyForm({ ...surveyForm, title: e.target.value })}
                placeholder="설문 제목"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">설명 (선택)</label>
              <input
                value={surveyForm.description}
                onChange={(e) => setSurveyForm({ ...surveyForm, description: e.target.value })}
                placeholder="설문에 대한 간단한 설명"
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium">질문 목록</label>
              {surveyForm.questions.map((q, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">질문 {i + 1}{(q.required !== false) && <span className="text-red-500 ml-0.5">*</span>}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required !== false}
                          onChange={(e) => {
                            const qs = [...surveyForm.questions];
                            qs[i] = { ...qs[i], required: e.target.checked };
                            setSurveyForm({ ...surveyForm, questions: qs });
                          }}
                          className="w-3.5 h-3.5 text-blue-600 rounded"
                        />
                        <span className="text-xs text-gray-500">필수</span>
                      </label>
                      {surveyForm.questions.length > 1 && (
                        <button
                          onClick={() => {
                            const qs = surveyForm.questions.filter((_, idx) => idx !== i);
                            setSurveyForm({ ...surveyForm, questions: qs });
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    value={q.q}
                    onChange={(e) => {
                      const qs = [...surveyForm.questions];
                      qs[i] = { ...qs[i], q: e.target.value };
                      setSurveyForm({ ...surveyForm, questions: qs });
                    }}
                    placeholder="질문 내용을 입력하세요"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => {
                      const qs = [...surveyForm.questions];
                      qs[i] = { ...qs[i], type: e.target.value };
                      setSurveyForm({ ...surveyForm, questions: qs });
                    }}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                  >
                    <option value="text">주관식</option>
                    <option value="choice">객관식</option>
                  </select>
                  {q.type === "choice" && (
                    <div className="space-y-2">
                      {(q.options?.length ? q.options : [""]).map((opt, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4 text-center">{j + 1}</span>
                          <input
                            value={opt}
                            onChange={(e) => {
                              const qs = [...surveyForm.questions];
                              const opts = [...(qs[i].options || [""])];
                              opts[j] = e.target.value;
                              qs[i] = { ...qs[i], options: opts };
                              setSurveyForm({ ...surveyForm, questions: qs });
                            }}
                            placeholder={`선지 ${j + 1}`}
                            className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                          />
                          {(q.options?.length || 1) > 1 && (
                            <button
                              onClick={() => {
                                const qs = [...surveyForm.questions];
                                const opts = (qs[i].options || []).filter((_, idx) => idx !== j);
                                qs[i] = { ...qs[i], options: opts };
                                setSurveyForm({ ...surveyForm, questions: qs });
                              }}
                              className="text-gray-400 hover:text-red-500 text-sm px-1"
                              title="선지 삭제"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const qs = [...surveyForm.questions];
                          qs[i] = { ...qs[i], options: [...(qs[i].options || []), ""] };
                          setSurveyForm({ ...surveyForm, questions: qs });
                        }}
                        className="text-xs text-blue-600 hover:underline ml-6"
                      >
                        + 선지 추가
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setSurveyForm({ ...surveyForm, questions: [...surveyForm.questions, { q: "", type: "text", options: [], required: true }] })}
                className="text-sm text-blue-600 hover:underline"
              >
                + 질문 추가
              </button>
            </div>

            {editingSurvey && (
              <div className="pt-2 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingSurvey.isActive}
                    onChange={(e) => setEditingSurvey({ ...editingSurvey, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">설문 활성화 (비활성화 시 응답 불가)</span>
                </label>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  if (!surveyForm.title.trim()) return alert("제목을 입력해주세요.");
                  if (surveyForm.questions.some((q) => !q.q.trim())) return alert("모든 질문을 입력해주세요.");

                  // 빈 선지 필터링
                  const cleanedQuestions = surveyForm.questions.map((q) => ({
                    ...q,
                    options: q.type === "choice" ? (q.options || []).filter((o) => o.trim()) : q.options,
                  }));

                  if (editingSurvey) {
                    const res = await fetch(`/api/surveys/${editingSurvey.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: surveyForm.title,
                        description: surveyForm.description,
                        questions: cleanedQuestions,
                        isActive: editingSurvey.isActive,
                      }),
                    });
                    if (res.ok) { setShowSurveyForm(false); fetchSurveys(); }
                  } else {
                    const res = await fetch("/api/surveys", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: surveyForm.title,
                        description: surveyForm.description,
                        questions: cleanedQuestions,
                        batchId,
                      }),
                    });
                    if (res.ok) { setShowSurveyForm(false); fetchSurveys(); }
                  }
                }}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
              >
                {editingSurvey ? "저장" : "생성"}
              </button>
              <button
                onClick={() => setShowSurveyForm(false)}
                className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Tab */}
      {tab === "settlement" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">훈련비 결산</h3>
              {settlementRows.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSettlementRows((prev) =>
                        prev.map((r) => ({
                          ...r,
                          completedHours: r.calculatedHours ?? r.completedHours,
                        }))
                      );
                    }}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 border"
                  >
                    출퇴근 기준 자동계산
                  </button>
                  <button
                    onClick={handleSettlementSave}
                    disabled={settlementSaving}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {settlementSaving ? "저장 중..." : "이수시간 저장"}
                  </button>
                </div>
              )}
            </div>
            {settlementRows.length > 0 && settlementRows.some((r) => r.calculatedHours != null) && (
              <div className="px-4 py-2 bg-blue-50 border-b text-xs text-blue-700">
                출퇴근 기록 기준 자동계산 (점심 11:30~12:30 제외, 0.5시간 단위 내림)
              </div>
            )}
            {settlementLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-6 w-6 border-4 border-blue-600 border-t-transparent rounded-full" />
              </div>
            ) : settlementRows.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center">출근 처리된 참석자가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-center px-3 py-2 font-medium w-12">순번</th>
                      <th className="text-left px-3 py-2 font-medium">참석자</th>
                      <th className="text-right px-3 py-2 font-medium w-28">시간당 훈련비</th>
                      <th className="text-right px-3 py-2 font-medium w-24">부과시간</th>
                      <th className="text-center px-3 py-2 font-medium w-28">이수시간</th>
                      <th className="text-right px-3 py-2 font-medium w-24">감액</th>
                      <th className="text-right px-3 py-2 font-medium w-28">지급액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(() => {
                      const isWeekend = (() => {
                        if (!settlementStartDate) return false;
                        const d = new Date(settlementStartDate);
                        const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                        const day = kst.getUTCDay();
                        return day === 0 || day === 6;
                      })();
                      const hourlyRate = isWeekend ? 18750 : 12500;
                      const reqHours = settlementRequiredHours || 0;

                      return settlementRows.map((row, idx) => {
                        const completed = row.completedHours ?? row.calculatedHours ?? reqHours;
                        const deduction = completed < reqHours ? Math.round((reqHours - completed) * hourlyRate) : 0;
                        const totalPay = Math.round(reqHours * hourlyRate);
                        const payAmount = totalPay - deduction;

                        return (
                          <tr key={row.batchUserId} className="hover:bg-gray-50">
                            <td className="text-center px-3 py-2 text-gray-400">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <span className="text-gray-500">{row.rank}</span> {row.name}
                            </td>
                            <td className="text-right px-3 py-2 text-gray-600">
                              {isWeekend ? "18,750" : "12,500"}원
                            </td>
                            <td className="text-right px-3 py-2">{reqHours}시간</td>
                            <td className="text-center px-3 py-2">
                              <div className="flex flex-col items-center gap-0.5">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max={reqHours || 999}
                                  value={row.completedHours ?? ""}
                                  placeholder={row.calculatedHours != null ? String(row.calculatedHours) : String(reqHours)}
                                  onChange={(e) => {
                                    const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                    setSettlementRows((prev) =>
                                      prev.map((r, i) => i === idx ? { ...r, completedHours: val } : r)
                                    );
                                  }}
                                  className="w-20 px-2 py-1 border rounded text-sm text-center"
                                />
                                {row.calculatedHours != null && row.completedHours == null && (
                                  <span className="text-[10px] text-blue-500">자동 {row.calculatedHours}h</span>
                                )}
                              </div>
                            </td>
                            <td className="text-right px-3 py-2 text-red-600">
                              {deduction > 0 ? `-${deduction.toLocaleString()}원` : "-"}
                            </td>
                            <td className="text-right px-3 py-2 font-medium">
                              {payAmount.toLocaleString()}원
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="bg-gray-50 font-medium">
                    <tr>
                      <td colSpan={6} className="text-right px-3 py-2">합계</td>
                      <td className="text-right px-3 py-2">
                        {(() => {
                          const isWeekend = (() => {
                            if (!settlementStartDate) return false;
                            const d = new Date(settlementStartDate);
                            const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
                            const day = kst.getUTCDay();
                            return day === 0 || day === 6;
                          })();
                          const hourlyRate = isWeekend ? 18750 : 12500;
                          const reqHours = settlementRequiredHours || 0;
                          const total = settlementRows.reduce((sum, row) => {
                            const completed = row.completedHours ?? row.calculatedHours ?? reqHours;
                            const deduction = completed < reqHours ? Math.round((reqHours - completed) * hourlyRate) : 0;
                            return sum + (Math.round(reqHours * hourlyRate) - deduction);
                          }, 0);
                          return `${total.toLocaleString()}원`;
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meals Tab */}
      {tab === "meals" && batch && (() => {
        const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
        const mealDateRange = getDateRange(batch.startDate, batch.endDate);
        const allMealDates = mealDateRange.map((isoDate) => {
          const d = new Date(isoDate + "T00:00:00");
          return { date: isoDate, label: `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})` };
        });

        const handleOpenMealForm = () => {
          const inputs: DayMealInput[] = allMealDates.map(({ date, label }) => {
            const existing = mealsList.filter((m) => new Date(m.date).toISOString().split("T")[0] === date);
            return {
              date, label,
              BREAKFAST: existing.find((m) => m.type === "BREAKFAST")?.menuInfo || "",
              LUNCH: existing.find((m) => m.type === "LUNCH")?.menuInfo || "",
              DINNER: existing.find((m) => m.type === "DINNER")?.menuInfo || "",
            };
          });
          setMealDayInputs(inputs);
          setShowMealForm(true);
        };

        const handleMealInputChange = (index: number, type: "BREAKFAST" | "LUNCH" | "DINNER", value: string) => {
          setMealDayInputs((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [type]: value };
            return next;
          });
        };

        const handleMealBulkSubmit = async () => {
          setMealSubmitting(true);
          try {
            const promises: Promise<Response>[] = [];
            for (const day of mealDayInputs) {
              for (const type of ["BREAKFAST", "LUNCH", "DINNER"] as const) {
                const menuInfo = day[type].trim();
                if (menuInfo) {
                  promises.push(
                    fetch("/api/meals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ batchId, date: day.date, type, menuInfo, headcount: 0 }),
                    })
                  );
                }
              }
            }
            await Promise.all(promises);
            setShowMealForm(false);
            fetchMealsList();
          } catch {
            alert("저장 중 오류가 발생했습니다.");
          } finally {
            setMealSubmitting(false);
          }
        };

        const handleMealEditOpen = (meal: MealData) => {
          setEditingMealData(meal);
          setMealEditForm({ menuInfo: meal.menuInfo || "", headcount: meal.headcount });
        };

        const handleMealEditSave = async () => {
          if (!editingMealData) return;
          const res = await fetch(`/api/meals/${editingMealData.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(mealEditForm),
          });
          if (res.ok) { setEditingMealData(null); fetchMealsList(); }
        };

        const handleMealDelete = async (mealId: string) => {
          if (!confirm("식사 정보를 삭제하시겠습니까?")) return;
          const res = await fetch(`/api/meals/${mealId}`, { method: "DELETE" });
          if (res.ok) fetchMealsList();
        };

        const handleMealApplyAttendance = (dateKey: string) => {
          const info = mealAttendanceByDate[dateKey];
          if (!info) return;
          setMealEditForm((prev) => ({ ...prev, headcount: info.presentCount }));
        };

        const handleDinnerAction = async (requestId: string, action: "approve" | "reject" | "cancel") => {
          const res = await fetch("/api/meals/dinner-request", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requestId, action }),
          });
          if (res.ok) fetchDinnerReqs();
          else { const err = await res.json(); alert(err.error || "처리 실패"); }
        };

        return (
          <div className="space-y-4">
            {/* 식사 등록 버튼 */}
            <div className="flex justify-end">
              <button onClick={handleOpenMealForm} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                + 식사 등록
              </button>
            </div>

            {/* 탭: 식사 / 석식 신청 */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setMealDinnerTab("meals")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${mealDinnerTab === "meals" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                식사 현황
              </button>
              <button
                onClick={() => setMealDinnerTab("dinner")}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${mealDinnerTab === "dinner" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                석식 신청
              </button>
            </div>

            {/* 석식 신청 탭 */}
            {mealDinnerTab === "dinner" && (
              <div className="space-y-3">
                {dinnerRequests.length > 0 ? dinnerRequests.map((dr) => {
                  const stMap: Record<string, { label: string; color: string }> = {
                    PENDING: { label: "대기", color: "bg-yellow-100 text-yellow-700" },
                    APPROVED: { label: "승인", color: "bg-green-100 text-green-700" },
                    REJECTED: { label: "반려", color: "bg-red-100 text-red-700" },
                    CANCELLED: { label: "취소", color: "bg-gray-100 text-gray-500" },
                  };
                  const st = stMap[dr.status] || { label: dr.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <div key={dr.id} className="bg-white rounded-xl border p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            {dr.user.rank} {dr.user.name}
                            <span className="text-gray-400 text-xs ml-2">{dr.user.serviceNumber}</span>
                          </p>
                          <p className="text-sm text-gray-600">{new Date(dr.date).toLocaleDateString("ko-KR")} 석식</p>
                          <p className="text-xs text-gray-400 mt-0.5">신청일: {new Date(dr.createdAt).toLocaleDateString("ko-KR")}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                          {dr.status === "PENDING" && (
                            <div className="flex gap-1">
                              <button onClick={() => handleDinnerAction(dr.id, "approve")} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">승인</button>
                              <button onClick={() => handleDinnerAction(dr.id, "reject")} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700">반려</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center py-8 text-gray-400">석식 신청 내역이 없습니다.</p>
                )}
              </div>
            )}

            {/* 날짜별 식사 목록 */}
            {mealDinnerTab === "meals" && (
              <div className="space-y-4">
                {allMealDates.length > 0 ? allMealDates.map(({ date: isoDate, label: dayLabel }) => {
                  const dayMeals = mealsList.filter((m) => new Date(m.date).toISOString().split("T")[0] === isoDate);
                  const attInfo = mealAttendanceByDate[isoDate];
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
                              className={`p-3 rounded-lg ${meal ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"} ${!meal && inlineMealKey !== `${isoDate}-${type}` ? "cursor-pointer hover:bg-gray-100" : ""}`}
                              onClick={() => {
                                if (!meal && inlineMealKey !== `${isoDate}-${type}`) {
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
                                  <div className="flex gap-2 mt-2">
                                    <button onClick={() => handleMealEditOpen(meal)} className="text-xs text-blue-600 hover:underline">수정</button>
                                    <button onClick={() => handleMealDelete(meal.id)} className="text-xs text-red-600 hover:underline">삭제</button>
                                  </div>
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
                                          body: JSON.stringify({ batchId, date: isoDate, type, menuInfo: inlineMealValue.trim(), headcount: 0 }),
                                        });
                                        setInlineMealKey(null);
                                        fetchMealsList();
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
                                        body: JSON.stringify({ batchId, date: isoDate, type, menuInfo: inlineMealValue.trim(), headcount: 0 }),
                                      });
                                      setInlineMealKey(null);
                                      fetchMealsList();
                                    }}
                                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs shrink-0"
                                  >
                                    등록
                                  </button>
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">터치하여 등록</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center py-8 text-gray-400">차수 날짜 정보가 없습니다.</p>
                )}
              </div>
            )}

            {/* 등록 모달 */}
            {showMealForm && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">식사 메뉴 등록</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{batch.name} ({mealDayInputs.length}일)</p>
                    </div>
                    <button onClick={() => setShowMealForm(false)} className="text-gray-400 hover:text-gray-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {mealDayInputs.map((day, index) => {
                      const isWknd = new Date(day.date + "T00:00:00").getDay() === 0 || new Date(day.date + "T00:00:00").getDay() === 6;
                      return (
                        <div key={day.date} className={`border rounded-lg p-4 ${isWknd ? "border-red-200 bg-red-50/30" : ""}`}>
                          <p className={`text-sm font-semibold mb-3 ${isWknd ? "text-red-500" : "text-gray-700"}`}>{day.label}</p>
                          <div className="grid grid-cols-3 gap-3">
                            {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((type) => (
                              <div key={type}>
                                <label className="block text-xs text-gray-500 mb-1">{MEAL_TYPE_LABELS[type]}</label>
                                <input
                                  type="text"
                                  value={day[type]}
                                  onChange={(e) => handleMealInputChange(index, type, e.target.value)}
                                  className="w-full px-2 py-1.5 border rounded text-sm"
                                  placeholder="메뉴 입력"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-6 py-4 border-t flex gap-3">
                    <button onClick={handleMealBulkSubmit} disabled={mealSubmitting} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                      {mealSubmitting ? "저장 중..." : "일괄 저장"}
                    </button>
                    <button onClick={() => setShowMealForm(false)} className="flex-1 py-2.5 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
                  </div>
                </div>
              </div>
            )}

            {/* 수정 모달 */}
            {editingMealData && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
                  <h3 className="text-lg font-semibold">식사 수정</h3>
                  <p className="text-sm text-gray-500">{MEAL_TYPE_LABELS[editingMealData.type]} - {new Date(editingMealData.date).toLocaleDateString("ko-KR")}</p>
                  <div>
                    <label className="block text-sm font-medium mb-1">메뉴</label>
                    <textarea value={mealEditForm.menuInfo} onChange={(e) => setMealEditForm({ ...mealEditForm, menuInfo: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">인원</label>
                    <div className="flex gap-2">
                      <input type="number" value={mealEditForm.headcount} onChange={(e) => setMealEditForm({ ...mealEditForm, headcount: parseInt(e.target.value) || 0 })} className="flex-1 px-3 py-2 border rounded-lg" />
                      <button
                        type="button"
                        onClick={() => handleMealApplyAttendance(new Date(editingMealData.date).toISOString().split("T")[0])}
                        className="px-3 py-2 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 whitespace-nowrap"
                      >
                        참석인원 적용
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleMealEditSave} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">저장</button>
                    <button onClick={() => setEditingMealData(null)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">차수 기본 정보</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">차수명</label>
              <input
                value={settingsForm.name}
                onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">연도</label>
                <input
                  type="number"
                  value={settingsForm.year}
                  onChange={(e) => setSettingsForm({ ...settingsForm, year: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">차수 번호</label>
                <input
                  type="number"
                  value={settingsForm.number}
                  onChange={(e) => setSettingsForm({ ...settingsForm, number: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">시작일</label>
                <input
                  type="date"
                  value={settingsForm.startDate}
                  onChange={(e) => setSettingsForm({ ...settingsForm, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">종료일</label>
                <input
                  type="date"
                  value={settingsForm.endDate}
                  onChange={(e) => setSettingsForm({ ...settingsForm, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">훈련 장소</label>
              <input
                value={settingsForm.location}
                onChange={(e) => setSettingsForm({ ...settingsForm, location: e.target.value })}
                placeholder="예: 00사단 훈련장"
                className="w-full px-3 py-2 border rounded-lg mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">부과시간 (시간)</label>
              <input
                type="number"
                value={settingsForm.requiredHours}
                onChange={(e) => setSettingsForm({ ...settingsForm, requiredHours: e.target.value })}
                placeholder="예: 8"
                className="w-full px-3 py-2 border rounded-lg mt-1"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  await handleSaveSettings();
                  setShowSettingsModal(false);
                }}
                disabled={settingsSaving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {settingsSaving ? "저장 중..." : "저장"}
              </button>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Training add modal */}
      {showTrainingForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-semibold">
              훈련 추가 - {new Date(trainingFormDate).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </h3>
            <input
              placeholder="훈련명"
              value={trainingForm.title}
              onChange={(e) => setTrainingForm({ ...trainingForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <select
              value={trainingForm.type}
              onChange={(e) => {
                const newType = e.target.value;
                const isMeal = newType === "식사";
                setTrainingForm({ ...trainingForm, type: newType, countsTowardHours: isMeal ? false : trainingForm.countsTowardHours });
              }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {trainingCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">시작 시간</label>
                <input
                  type="time"
                  value={trainingForm.startTime}
                  onChange={(e) => setTrainingForm({ ...trainingForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium">종료 시간</label>
                <input
                  type="time"
                  value={trainingForm.endTime}
                  onChange={(e) => setTrainingForm({ ...trainingForm, endTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <input
              placeholder="장소"
              value={trainingForm.location}
              onChange={(e) => setTrainingForm({ ...trainingForm, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <select
              value={trainingForm.instructorId}
              onChange={(e) => setTrainingForm({ ...trainingForm, instructorId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">교관 선택 (선택사항)</option>
              {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input
              placeholder="비고 (선택)"
              value={trainingForm.description}
              onChange={(e) => setTrainingForm({ ...trainingForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {/* 출석부 / 이수시간 옵션 */}
            <div className="space-y-2 pt-1 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trainingForm.attendanceEnabled}
                  onChange={(e) => setTrainingForm({ ...trainingForm, attendanceEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">출석부 기능 활성화</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trainingForm.countsTowardHours}
                  onChange={(e) => setTrainingForm({ ...trainingForm, countsTowardHours: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">훈련 이수시간에 반영</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreateTraining} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">추가</button>
              <button onClick={() => setShowTrainingForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 사유서 조회/인쇄 모달 */}
      {viewingReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {viewingReport.type === "EARLY_DEPARTURE" ? "조기퇴소 확인서" :
                 viewingReport.type === "ABSENT" ? "불참 개인 사유서" :
                 REASON_TYPE_LABELS[viewingReport.type] || "사유서"}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) return;
                    let parsedContent: Record<string, string> = {};
                    try { parsedContent = JSON.parse(viewingReport.content); } catch { parsedContent = { reason: viewingReport.content }; }
                    const { user, batch: rBatch } = viewingReport.batchUser;
                    const createdDate = new Date(viewingReport.createdAt);
                    const submittedAtStr = `${createdDate.getFullYear()}년 ${createdDate.getMonth() + 1}월 ${createdDate.getDate()}일 ${String(createdDate.getHours()).padStart(2, "0")}시 ${String(createdDate.getMinutes()).padStart(2, "0")}분 ${String(createdDate.getSeconds()).padStart(2, "0")}초`;

                    let printHtml = "";

                    if (viewingReport.type === "EARLY_DEPARTURE") {
                      // 조기퇴소 확인서 - 참고 양식 그대로
                      printHtml = `<!DOCTYPE html><html><head><title>조기퇴소 확인서</title>
                        <style>
                          @page { size: A4; margin: 20mm; }
                          body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; font-size: 14px; }
                          h1 { text-align: center; font-size: 24px; margin-bottom: 30px; letter-spacing: 8px; }
                          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                          td, th { border: 1px solid #333; padding: 10px 14px; font-size: 14px; }
                          .label { background: #f5f5f5; font-weight: bold; width: 120px; text-align: center; white-space: nowrap; }
                          .reason-box { min-height: 180px; vertical-align: top; white-space: pre-wrap; line-height: 1.8; }
                          .notice { font-size: 13px; line-height: 1.8; padding: 14px; }
                          .signature-section { margin-top: 40px; text-align: center; font-size: 14px; }
                          .signature-section p { margin: 6px 0; }
                          .submitted-at { text-align: right; font-size: 11px; color: #666; margin-top: 10px; }
                          @media print { body { padding: 0; } }
                        </style></head><body>
                        <h1>조 기 퇴 소   확 인 서</h1>
                        <table>
                          <tr><td class="label">소 속</td><td>${user.unit || ""}</td><td class="label">직 책</td><td>${(user as { branch?: string }).branch || ""}</td></tr>
                          <tr><td class="label">성 명</td><td>${user.name}</td><td class="label">군 번</td><td>${user.serviceNumber || ""}</td></tr>
                          <tr><td class="label">훈련일자</td><td colspan="3">${parsedContent.departureDate || ""}</td></tr>
                          <tr><td class="label">조기퇴소<br/>시간</td><td colspan="3">${parsedContent.departureTime || ""}</td></tr>
                          <tr><td class="label">조기 퇴소<br/>사유</td><td colspan="3" class="reason-box">${parsedContent.reason || ""}</td></tr>
                        </table>
                        <div class="notice">
                          <p>1. 본인은 위 사유로 인하여 비상근 예비군 훈련에서 예정보다 일찍 퇴소하겠습니다.</p>
                          <p>2. 본인은 조기퇴소에 대한 안내사항을 사전에 인지하였으며 시간당 평일 12,500원 주말 18,750원의 훈련비가 감액됨을 확인하였습니다.</p>
                        </div>
                        <div class="signature-section">
                          <p>${createdDate.getFullYear()}년 &nbsp;&nbsp; ${createdDate.getMonth() + 1}월 &nbsp;&nbsp; ${createdDate.getDate()}일</p>
                          <p style="margin-top: 20px;">작 성 자: &nbsp;&nbsp;&nbsp; ${user.name} &nbsp;&nbsp;&nbsp;&nbsp; (인/서명)</p>
                          <p style="margin-top: 20px;">601수송대대장 귀하</p>
                        </div>
                        <div class="submitted-at">제출 시점: ${submittedAtStr}</div>
                      </body></html>`;
                    } else if (viewingReport.type === "ABSENT") {
                      // 불참 개인 사유서 - 참고 양식 그대로
                      printHtml = `<!DOCTYPE html><html><head><title>불참 개인 사유서</title>
                        <style>
                          @page { size: A4; margin: 20mm; }
                          body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; font-size: 14px; }
                          h1 { text-align: center; font-size: 24px; margin-bottom: 30px; letter-spacing: 8px; }
                          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                          td, th { border: 1px solid #333; padding: 10px 14px; font-size: 14px; }
                          .label { background: #f5f5f5; font-weight: bold; width: 100px; text-align: center; vertical-align: middle; }
                          .sub-label { font-weight: bold; width: 90px; text-align: center; }
                          .reason-box { min-height: 250px; vertical-align: top; white-space: pre-wrap; line-height: 1.8; }
                          .signature-section { margin-top: 40px; text-align: center; font-size: 14px; }
                          .signature-section p { margin: 6px 0; }
                          .submitted-at { text-align: right; font-size: 11px; color: #666; margin-top: 10px; }
                          @media print { body { padding: 0; } }
                        </style></head><body>
                        <h1>불 참  개 인  사 유 서</h1>
                        <table>
                          <tr>
                            <td class="label" rowspan="2">인적사항</td>
                            <td class="sub-label">성 명</td><td>${user.name}</td>
                            <td class="sub-label">생년월일</td><td></td>
                          </tr>
                          <tr>
                            <td class="sub-label">E-mail</td><td></td>
                            <td class="sub-label">휴대폰번호</td><td></td>
                          </tr>
                          <tr>
                            <td class="label">개인 사유<br/>내용 기술<br/><br/><span style="font-size:12px;color:#666;">(6하원칙에<br/>의거)</span></td>
                            <td colspan="4" class="reason-box">${parsedContent.reason || ""}</td>
                          </tr>
                        </table>
                        <div class="signature-section">
                          <p>위와 같이 확인합니다.</p>
                          <p style="margin-top: 16px;">${createdDate.getFullYear()}년 &nbsp;&nbsp; ${createdDate.getMonth() + 1}월 &nbsp;&nbsp; ${createdDate.getDate()}일</p>
                          <p style="margin-top: 20px;">성명: &nbsp;&nbsp;&nbsp; ${user.name} &nbsp;&nbsp;&nbsp;&nbsp; 직인(서명)</p>
                          <p style="margin-top: 20px;">601수송대대장 귀하</p>
                        </div>
                        <div class="submitted-at">제출 시점: ${submittedAtStr}</div>
                      </body></html>`;
                    } else {
                      // 지연입소 사유서 - 기존 양식 유지 + 초 단위 시간
                      printHtml = `<!DOCTYPE html><html><head><title>${REASON_TYPE_LABELS[viewingReport.type]}</title>
                        <style>
                          @page { size: A4; margin: 20mm; }
                          body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; }
                          h1 { text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                          td { border: 1px solid #999; padding: 8px 12px; font-size: 14px; }
                          .label { background: #f5f5f5; font-weight: bold; width: 120px; }
                          .reason-box { border: 1px solid #999; padding: 16px; min-height: 120px; white-space: pre-wrap; font-size: 14px; line-height: 1.8; }
                          .signature-area { margin-top: 40px; text-align: right; font-size: 14px; }
                          .signature-area p { margin: 4px 0; }
                          .date-line { margin-top: 30px; text-align: center; font-size: 14px; }
                          .submitted-at { text-align: right; font-size: 11px; color: #666; margin-top: 10px; }
                          @media print { body { padding: 0; } }
                        </style></head><body>
                        <h1>${REASON_TYPE_LABELS[viewingReport.type]}</h1>
                        <table>
                          <tr><td class="label">성명</td><td>${user.name}</td><td class="label">계급</td><td>${user.rank || "-"}</td></tr>
                          <tr><td class="label">군번</td><td>${user.serviceNumber || "-"}</td><td class="label">소속</td><td>${user.unit || "-"}</td></tr>
                          <tr><td class="label">훈련차수</td><td colspan="3">${rBatch.name}</td></tr>
                          <tr><td class="label">훈련기간</td><td colspan="3">${new Date(rBatch.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(rBatch.endDate).toLocaleDateString("ko-KR")}</td></tr>
                          <tr><td class="label">입소 예정 일시</td><td colspan="3">${parsedContent.arrivalDate || parsedContent.date || "-"} ${parsedContent.arrivalTime || parsedContent.time || ""}</td></tr>
                        </table>
                        <div style="margin-top:20px;"><h3 style="font-size:15px;margin-bottom:10px;">사유</h3><div class="reason-box">${parsedContent.reason || viewingReport.content}</div></div>
                        <div class="date-line">${createdDate.getFullYear()}년 ${createdDate.getMonth() + 1}월 ${createdDate.getDate()}일</div>
                        <div class="signature-area"><p>위 사유서를 제출합니다.</p><p style="margin-top:20px;">성명: ${user.name} (인)</p></div>
                        <div class="submitted-at">제출 시점: ${submittedAtStr}</div>
                      </body></html>`;
                    }

                    printWindow.document.write(printHtml);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 300);
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  인쇄
                </button>
                <button
                  onClick={() => setViewingReport(null)}
                  className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 사유서 내용 표시 */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">성명:</span> {viewingReport.batchUser.user.name}</div>
                <div><span className="text-gray-500">계급:</span> {viewingReport.batchUser.user.rank || "-"}</div>
                <div><span className="text-gray-500">군번:</span> {viewingReport.batchUser.user.serviceNumber || "-"}</div>
                <div><span className="text-gray-500">소속:</span> {viewingReport.batchUser.user.unit || "-"}</div>
              </div>
              <div className="border-t pt-2 mt-2">
                <div><span className="text-gray-500">훈련차수:</span> {viewingReport.batchUser.batch.name}</div>
                <div><span className="text-gray-500">훈련기간:</span> {new Date(viewingReport.batchUser.batch.startDate).toLocaleDateString("ko-KR")} ~ {new Date(viewingReport.batchUser.batch.endDate).toLocaleDateString("ko-KR")}</div>
              </div>
            </div>

            {(() => {
              let parsed: Record<string, string> = {};
              try { parsed = JSON.parse(viewingReport.content); } catch { parsed = { reason: viewingReport.content }; }
              return (
                <div className="space-y-3">
                  {viewingReport.type === "LATE_ARRIVAL" && (parsed.arrivalDate || parsed.date) && (
                    <div className="text-sm">
                      <span className="text-gray-500">입소 예정:</span>
                      <span className="ml-2 font-medium">{parsed.arrivalDate || parsed.date} {parsed.arrivalTime || parsed.time}</span>
                    </div>
                  )}
                  {viewingReport.type === "EARLY_DEPARTURE" && (parsed.departureDate || parsed.departureTime) && (
                    <div className="text-sm space-y-1">
                      <div><span className="text-gray-500">훈련일자:</span> <span className="font-medium">{parsed.departureDate}</span></div>
                      <div><span className="text-gray-500">퇴소시간:</span> <span className="font-medium">{parsed.departureTime}</span></div>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 mb-1">사유</p>
                    <p className="text-sm bg-white border rounded-lg p-3 whitespace-pre-wrap">{parsed.reason || viewingReport.content}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    제출 시점: {new Date(viewingReport.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </p>
                </div>
              );
            })()}

            {/* 해당 사용자의 다른 사유서 목록 */}
            {reasonReports.filter((r) => r.batchUserId === viewingReport.batchUserId && r.id !== viewingReport.id).length > 0 && (
              <div className="border-t pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">동일 대상자의 다른 사유서</p>
                <div className="space-y-1">
                  {reasonReports.filter((r) => r.batchUserId === viewingReport.batchUserId && r.id !== viewingReport.id).map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setViewingReport(r)}
                      className="w-full text-left p-2 bg-gray-50 rounded text-xs hover:bg-gray-100"
                    >
                      {REASON_TYPE_LABELS[r.type]} - 제출: {new Date(r.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 건강관리 문진표 조회/인쇄 모달 */}
      {viewingHealth && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">건강관리 문진표</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) return;
                    let answers: Record<string, boolean | string> = {};
                    try { answers = JSON.parse(viewingHealth.answers); } catch { /* ignore */ }
                    const { user } = viewingHealth.batchUser;
                    const submittedDate = new Date(viewingHealth.submittedAt);
                    const submittedAtStr = `${submittedDate.getFullYear()}년 ${submittedDate.getMonth() + 1}월 ${submittedDate.getDate()}일 ${String(submittedDate.getHours()).padStart(2, "0")}시 ${String(submittedDate.getMinutes()).padStart(2, "0")}분 ${String(submittedDate.getSeconds()).padStart(2, "0")}초`;

                    const questions = [
                      { key: "q1_chronic", label: "만성질환 여부", detail: "q1_chronic_detail" },
                      { key: "q2_treating", label: "현재 치료 중 질병" },
                      { key: "q3_medication", label: "과거 병력/약물 복용", detail: "q3_medication_detail" },
                      { key: "q4_exercise_symptoms", label: "운동 중 증상 경험" },
                      { key: "q5_blood_pressure_meds", label: "혈압약 복용" },
                      { key: "q6_fatigue", label: "피로감/건강이상" },
                      { key: "q7_mental", label: "정신과적 증상" },
                      { key: "q8_family_history", label: "부모 심혈관 질환" },
                      { key: "q10_training_issue", label: "훈련 지장 여부" },
                    ];

                    const qRows = questions.map((q) => {
                      const val = answers[q.key] ? "예" : "아니요";
                      const detail = q.detail && answers[q.detail] ? ` (${answers[q.detail]})` : "";
                      return `<tr><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${q.label}</td><td style="padding:6px 10px;border:1px solid #333;text-align:center;font-size:13px;">${val}${detail}</td></tr>`;
                    }).join("");

                    const covidItems = ["q9_covid_1", "q9_covid_2", "q9_covid_3", "q9_covid_4"]
                      .map((k) => answers[k] ? "예" : "아니요").join(" / ");

                    printWindow.document.write(`<!DOCTYPE html><html><head><title>건강관리 문진표</title>
                      <style>
                        @page { size: A4; margin: 20mm; }
                        body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; max-width: 700px; margin: 0 auto; font-size: 14px; }
                        h1 { text-align: center; font-size: 22px; margin-bottom: 20px; letter-spacing: 6px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                        .submitted-at { text-align: right; font-size: 11px; color: #666; margin-top: 10px; }
                        @media print { body { padding: 0; } }
                      </style></head><body>
                      <h1>건 강 관 리  문 진 표</h1>
                      <table>
                        <tr><td style="padding:8px 12px;border:1px solid #333;background:#f5f5f5;font-weight:bold;width:100px;">성 명</td><td style="padding:8px 12px;border:1px solid #333;">${user.name}</td><td style="padding:8px 12px;border:1px solid #333;background:#f5f5f5;font-weight:bold;width:100px;">군 번</td><td style="padding:8px 12px;border:1px solid #333;">${user.serviceNumber || ""}</td></tr>
                        <tr><td style="padding:8px 12px;border:1px solid #333;background:#f5f5f5;font-weight:bold;">소 속</td><td style="padding:8px 12px;border:1px solid #333;" colspan="3">${user.unit || ""}</td></tr>
                      </table>
                      <table>${qRows}
                        <tr><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">코로나 관련 (7일감염/1일감염/14일접촉/현재증상)</td><td style="padding:6px 10px;border:1px solid #333;text-align:center;font-size:13px;">${covidItems}</td></tr>
                        <tr><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">기타 참고사항</td><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${answers.q11_other || "-"}</td></tr>
                        <tr><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">혈압</td><td style="padding:6px 10px;border:1px solid #333;text-align:center;font-size:13px;">${answers.bloodPressure || "-"}</td></tr>
                        <tr><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">체온</td><td style="padding:6px 10px;border:1px solid #333;text-align:center;font-size:13px;">${answers.temperature || "-"}</td></tr>
                      </table>
                      <div class="submitted-at">제출 시점: ${submittedAtStr}</div>
                    </body></html>`);
                    printWindow.document.close();
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 300);
                  }}
                  className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  인쇄
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`${viewingHealth.batchUser.user.name}의 문진표를 삭제하시겠습니까?\n삭제 후 대상자가 다시 작성할 수 있습니다.`)) return;
                    const res = await fetch(`/api/health-questionnaire?id=${viewingHealth.id}`, { method: "DELETE" });
                    if (res.ok) {
                      setHealthQuestionnaires((prev) => prev.filter((h) => h.id !== viewingHealth.id));
                      setViewingHealth(null);
                    } else {
                      alert("삭제에 실패했습니다.");
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                >
                  삭제
                </button>
                <button onClick={() => setViewingHealth(null)} className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                  닫기
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-gray-500">성명:</span> {viewingHealth.batchUser.user.name}</div>
                <div><span className="text-gray-500">군번:</span> {viewingHealth.batchUser.user.serviceNumber || "-"}</div>
                <div><span className="text-gray-500">소속:</span> {viewingHealth.batchUser.user.unit || "-"}</div>
              </div>
            </div>

            {(() => {
              let answers: Record<string, boolean | string> = {};
              try { answers = JSON.parse(viewingHealth.answers); } catch { /* ignore */ }
              const questions = [
                { key: "q1_chronic", label: "1. 만성질환", detail: "q1_chronic_detail" },
                { key: "q2_treating", label: "2. 현재 치료 중" },
                { key: "q3_medication", label: "3. 과거 병력/약물", detail: "q3_medication_detail" },
                { key: "q4_exercise_symptoms", label: "4. 운동 중 증상" },
                { key: "q5_blood_pressure_meds", label: "5. 혈압약 복용" },
                { key: "q6_fatigue", label: "6. 피로감/건강이상" },
                { key: "q7_mental", label: "7. 정신과적 증상" },
                { key: "q8_family_history", label: "8. 부모 심혈관질환" },
                { key: "q10_training_issue", label: "10. 훈련 지장" },
              ];
              return (
                <div className="space-y-2 text-sm">
                  {questions.map((q) => (
                    <div key={q.key} className="flex justify-between items-center py-1 border-b">
                      <span className="text-gray-700">{q.label}</span>
                      <span className={`font-medium ${answers[q.key] ? "text-red-600" : "text-green-600"}`}>
                        {answers[q.key] ? "예" : "아니요"}
                        {q.detail && answers[q.detail] ? ` (${answers[q.detail]})` : ""}
                      </span>
                    </div>
                  ))}
                  <div className="py-1 border-b">
                    <span className="text-gray-700">9. 코로나 관련</span>
                    <div className="ml-4 text-xs text-gray-500 space-y-0.5 mt-1">
                      {[
                        { key: "q9_covid_1", label: "7일 내 감염" },
                        { key: "q9_covid_2", label: "1일 내 감염" },
                        { key: "q9_covid_3", label: "14일 내 접촉" },
                        { key: "q9_covid_4", label: "현재 증상" },
                      ].map((c) => (
                        <div key={c.key} className="flex justify-between">
                          <span>{c.label}</span>
                          <span className={answers[c.key] ? "text-red-600 font-medium" : "text-green-600"}>{answers[c.key] ? "예" : "아니요"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {answers.q11_other && (
                    <div className="py-1 border-b">
                      <span className="text-gray-500">기타:</span> <span>{answers.q11_other as string}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div><span className="text-gray-500">혈압:</span> <span className="font-medium">{(answers.bloodPressure as string) || "-"}</span></div>
                    <div><span className="text-gray-500">체온:</span> <span className="font-medium">{(answers.temperature as string) || "-"}</span></div>
                  </div>
                  <p className="text-xs text-gray-400 pt-2">
                    제출 시점: {new Date(viewingHealth.submittedAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Training edit modal */}
      {editingTraining && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3">
            <h3 className="text-lg font-semibold">훈련 수정</h3>
            <input
              placeholder="훈련명"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <select
              value={editForm.type}
              onChange={(e) => {
                const newType = e.target.value;
                const isMeal = newType === "식사";
                setEditForm({ ...editForm, type: newType, countsTowardHours: isMeal ? false : editForm.countsTowardHours });
              }}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {trainingCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">시작 시간</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium">종료 시간</label>
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm({ ...editForm, endTime: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <input
              placeholder="장소"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <select
              value={editForm.instructorId}
              onChange={(e) => setEditForm({ ...editForm, instructorId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">교관 선택 (선택사항)</option>
              {instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <input
              placeholder="비고 (선택)"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {/* 출석부 / 이수시간 옵션 */}
            <div className="space-y-2 pt-1 border-t">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.attendanceEnabled}
                  onChange={(e) => setEditForm({ ...editForm, attendanceEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">출석부 기능 활성화</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.countsTowardHours}
                  onChange={(e) => setEditForm({ ...editForm, countsTowardHours: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">훈련 이수시간에 반영</span>
              </label>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">저장</button>
              <button onClick={() => setEditingTraining(null)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 스크롤 타임피커 */}
      {timePickerTarget && (
        <ScrollTimePicker
          value={commutingRows[timePickerTarget.idx]?.[timePickerTarget.field] || ""}
          title={timePickerTarget.field === "checkIn" ? "출근 시간 선택" : "퇴근 시간 선택"}
          onChange={(time) => {
            const { idx, field } = timePickerTarget;
            updateCommutingRow(idx, field, time);
          }}
          onClose={() => setTimePickerTarget(null)}
        />
      )}

      {/* 출퇴근 보고 모달 */}
      {reportType && batch && (() => {
        const reportRows = commutingRows.filter((r) => r.serviceNumber !== TEST_SN);
        const totalPlanned = reportRows.filter((r) => r.batchStatus !== "ABSENT").length;
        const checkedIn = reportRows.filter((r) => r.checkIn && r.batchStatus !== "ABSENT").length;
        const checkedOut = reportRows.filter((r) => r.checkOut && r.batchStatus !== "ABSENT").length;
        const pct = totalPlanned > 0 ? Math.round((checkedIn / totalPlanned) * 100) : 0;

        const reportText = reportType === "checkin"
          ? `[1군단]\n1. 소집부대 : 601수송대대\n2. 훈련계획인원 : ${totalPlanned}명\n3. 입소 : ${checkedIn}명 (계획:입소 ${pct}%)\n4. 특이사항 없음`
          : `601수송대대 훈련종료 이상무\n(입소 ${checkedIn}명, 퇴소 ${checkedOut}명)`;

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setReportType(null)}>
            <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold">
                {reportType === "checkin" ? "출근 보고" : "퇴근 보고"}
              </h3>
              <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-sm font-mono leading-relaxed">
                {reportText}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(reportText);
                    setReportCopied(true);
                    setTimeout(() => setReportCopied(false), 2000);
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
                    reportCopied ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {reportCopied ? "복사 완료!" : "복사하기"}
                </button>
                <button
                  onClick={() => setReportType(null)}
                  className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
