"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";
import { BATCH_STATUS_LABELS } from "@/lib/constants";

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
}

interface BatchUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  phone: string | null;
  unit: string | null;
  batchUserId?: string;
  batchStatus?: string;
  batchSubStatus?: string | null;
  batchReason?: string | null;
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

export default function AdminBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [tab, setTab] = useState<"training" | "trainees" | "attendance" | "commuting" | "settings">("training");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [trainingCategories, setTrainingCategories] = useState<TrainingCategory[]>([]);
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [trainingFormDate, setTrainingFormDate] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [trainingForm, setTrainingForm] = useState({
    title: "", type: "기타", startTime: "", endTime: "", location: "", description: "", instructorId: "",
  });

  // Edit training state
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [editForm, setEditForm] = useState({
    title: "", type: "기타", startTime: "", endTime: "", location: "", description: "", instructorId: "",
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

  // 사유서 관련
  const [reasonReports, setReasonReports] = useState<ReasonReportWithUser[]>([]);
  const [viewingReport, setViewingReport] = useState<ReasonReportWithUser | null>(null);

  // Settings tab state
  const [settingsForm, setSettingsForm] = useState({ name: "", year: 0, number: 0, startDate: "", endDate: "", location: "", requiredHours: "" });
  const [settingsSaving, setSettingsSaving] = useState(false);

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
    if (tab === "attendance") {
      fetchAttendanceSummary();
      fetchReasonReports();
    }
  }, [tab, fetchAttendanceSummary, fetchReasonReports, isAuthorized]);

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

  const handleCheckIn = (idx: number) => {
    updateCommutingRow(idx, "checkIn", getNowTime());
  };

  const handleCheckOut = (idx: number) => {
    updateCommutingRow(idx, "checkOut", getNowTime());
  };

  const handleCommutingSave = async () => {
    setCommutingSaving(true);
    const promises = commutingRows
      .filter((row) => row.attendanceStatus !== "ABSENT")
      .map((row) => {
        const checkInAt = row.checkIn ? `${commutingDate}T${row.checkIn}:00` : "";
        const checkOutAt = row.checkOut ? `${commutingDate}T${row.checkOut}:00` : "";

        return fetch("/api/commuting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isManual: true,
            userId: row.userId,
            date: commutingDate,
            checkInAt: checkInAt || undefined,
            checkOutAt: checkOutAt || undefined,
            note: row.note || undefined,
            batchId,
          }),
        });
      });

    await Promise.all(promises);
    setCommutingSaving(false);
    alert("저장 완료되었습니다.");
  };

  // Initialize settings form when batch loads or tab switches to settings
  useEffect(() => {
    if (batch && tab === "settings") {
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
  }, [batch, tab]);

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
    setTrainingForm({ title: "", type: "기타", startTime: "", endTime: "", location: "", description: "", instructorId: "" });
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
        description={`${batch._count.users}명 | ${batch._count.trainings}개 훈련`}
        actions={
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${STATUS_COLORS[batch.status] || "bg-gray-100"}`}>
            {BATCH_STATUS_LABELS[batch.status] || batch.status}
          </span>
        }
      />

      {/* Tab navigation */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("training")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "training" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          훈련계획
        </button>
        <button
          onClick={() => setTab("trainees")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "trainees" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          대상자 ({batch._count.users})
        </button>
        <button
          onClick={() => setTab("attendance")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "attendance" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          출석현황
        </button>
        <button
          onClick={() => setTab("commuting")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "commuting" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          출퇴근
        </button>
        <button
          onClick={() => setTab("settings")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "settings" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          차수 설정
        </button>
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
        <div className="grid md:grid-cols-2 gap-4">
          {/* Unassigned panel */}
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

          {/* Assigned panel */}
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
        </div>
      )}

      {/* Attendance Summary Tab */}
      {tab === "attendance" && (
        <div className="space-y-6">
          {/* 참석신고 현황 (대상자별 자기신고) */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <h3 className="font-semibold text-sm">참석신고 현황</h3>
              <div className="flex gap-3 text-xs">
                <span className="text-green-600">참석 {batch.users.filter((u) => u.batchStatus === "PRESENT").length}</span>
                <span className="text-red-600">불참 {batch.users.filter((u) => u.batchStatus === "ABSENT").length}</span>
                <span className="text-yellow-600">미정 {batch.users.filter((u) => !u.batchStatus || u.batchStatus === "PENDING").length}</span>
              </div>
            </div>
            <div className="divide-y">
              {batch.users.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">배정된 대상자가 없습니다.</p>
              ) : (
                batch.users.map((u) => {
                  const userReports = reasonReports.filter((r) => r.batchUserId === u.batchUserId);
                  return (
                    <div key={u.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          <span className="text-gray-500">{u.rank}</span> {u.name}
                        </span>
                        <span className="text-xs text-gray-400">{u.serviceNumber}</span>
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
                        {userReports.length > 0 && (
                          <button
                            onClick={() => setViewingReport(userReports[0])}
                            className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                            title="사유서 보기"
                          >
                            사유서 ({userReports.length})
                          </button>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.batchStatus === "PRESENT" ? "bg-green-100 text-green-700" :
                          u.batchStatus === "ABSENT" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {u.batchStatus === "PRESENT" ? "참석" : u.batchStatus === "ABSENT" ? "불참" : "미정"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 훈련별 출석 현황 */}
          <div>
            <h3 className="font-semibold text-sm mb-3 px-1">훈련별 출석 현황</h3>
            {attendanceLoading ? (
              <div className="text-center py-8 text-gray-400">로딩 중...</div>
            ) : (
              <div className="space-y-3">
                {batch.trainings.length === 0 && (
                  <p className="text-center py-8 text-gray-400">등록된 훈련이 없습니다.</p>
                )}
                {batch.trainings.map((t) => {
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
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t.type}</span>
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
        </div>
      )}

      {/* Commuting Tab */}
      {tab === "commuting" && (
        <div>
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
                      const isAbsent = row.attendanceStatus === "ABSENT";
                      const isPending = row.attendanceStatus === "PENDING";
                      return (
                        <tr
                          key={row.userId}
                          className={`${isAbsent ? "bg-red-50 opacity-60" : isPending ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                        >
                          <td className="px-4 py-2">
                            <span className="text-gray-500">{row.rank}</span> {row.name}
                            <span className="text-xs text-gray-400 ml-2">{row.serviceNumber}</span>
                          </td>
                          <td className="px-4 py-2">
                            {row.attendanceStatus ? (
                              <span className={`text-xs font-medium ${
                                row.attendanceStatus === "PRESENT" ? "text-green-600" :
                                row.attendanceStatus === "ABSENT" ? "text-red-600" :
                                "text-yellow-600"
                              }`}>
                                {row.attendanceStatus === "PRESENT" ? "참석" : row.attendanceStatus === "ABSENT" ? "불참" : "미정"}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 items-center">
                              <input
                                type="time"
                                value={row.checkIn}
                                onChange={(e) => updateCommutingRow(idx, "checkIn", e.target.value)}
                                disabled={isAbsent}
                                className="flex-1 px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                              />
                              <button
                                onClick={() => handleCheckIn(idx)}
                                disabled={isAbsent}
                                className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
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
                              <input
                                type="time"
                                value={row.checkOut}
                                onChange={(e) => updateCommutingRow(idx, "checkOut", e.target.value)}
                                disabled={isAbsent}
                                className="flex-1 px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                              />
                              <button
                                onClick={() => handleCheckOut(idx)}
                                disabled={isAbsent}
                                className="px-2 py-1 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
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
                  const isAbsent = row.attendanceStatus === "ABSENT";
                  return (
                    <div
                      key={row.userId}
                      className={`bg-white rounded-xl border p-4 ${isAbsent ? "bg-red-50 opacity-60" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="font-medium text-sm">
                          <span className="text-gray-500">{row.rank}</span> {row.name}
                        </div>
                        {row.attendanceStatus ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.attendanceStatus === "PRESENT" ? "bg-green-100 text-green-700" :
                            row.attendanceStatus === "ABSENT" ? "bg-red-100 text-red-700" :
                            "bg-yellow-100 text-yellow-700"
                          }`}>
                            {row.attendanceStatus === "PRESENT" ? "참석" : row.attendanceStatus === "ABSENT" ? "불참" : "미정"}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">출근시간</label>
                          <div className="flex gap-1">
                            <input
                              type="time"
                              value={row.checkIn}
                              onChange={(e) => updateCommutingRow(idx, "checkIn", e.target.value)}
                              disabled={isAbsent}
                              className="flex-1 px-2 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
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
                            <input
                              type="time"
                              value={row.checkOut}
                              onChange={(e) => updateCommutingRow(idx, "checkOut", e.target.value)}
                              disabled={isAbsent}
                              className="flex-1 px-2 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                            />
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

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
          <h3 className="text-lg font-semibold">차수 기본 정보</h3>
          <div>
            <label className="text-sm font-medium text-gray-700">차수명</label>
            <input
              value={settingsForm.name}
              onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
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
          <div className="pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={settingsSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {settingsSaving ? "저장 중..." : "저장"}
            </button>
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
              onChange={(e) => setTrainingForm({ ...trainingForm, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {trainingCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-4">
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
              <h3 className="text-lg font-semibold">{REASON_TYPE_LABELS[viewingReport.type] || "사유서"}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) return;
                    let parsedContent: { reason?: string; date?: string; time?: string } = {};
                    try { parsedContent = JSON.parse(viewingReport.content); } catch { parsedContent = { reason: viewingReport.content }; }
                    const { user, batch: rBatch } = viewingReport.batchUser;
                    const timeLabel = viewingReport.type === "LATE_ARRIVAL" ? "입소 예정 일시" : viewingReport.type === "EARLY_DEPARTURE" ? "퇴소 예정 일시" : "";
                    printWindow.document.write(`<!DOCTYPE html><html><head><title>${REASON_TYPE_LABELS[viewingReport.type]}</title>
                      <style>
                        body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; max-width: 700px; margin: 0 auto; }
                        h1 { text-align: center; font-size: 22px; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
                        .info-table td { border: 1px solid #999; padding: 8px 12px; font-size: 14px; }
                        .info-table .label { background: #f5f5f5; font-weight: bold; width: 120px; }
                        .reason-section { margin-top: 20px; }
                        .reason-section h3 { font-size: 15px; margin-bottom: 10px; }
                        .reason-box { border: 1px solid #999; padding: 16px; min-height: 120px; white-space: pre-wrap; font-size: 14px; line-height: 1.8; }
                        .signature-area { margin-top: 40px; text-align: right; font-size: 14px; }
                        .signature-area p { margin: 4px 0; }
                        .date-line { margin-top: 30px; text-align: center; font-size: 14px; }
                        @media print { body { padding: 20px; } }
                      </style></head><body>
                      <h1>${REASON_TYPE_LABELS[viewingReport.type]}</h1>
                      <table class="info-table">
                        <tr><td class="label">성명</td><td>${user.name}</td><td class="label">계급</td><td>${user.rank || "-"}</td></tr>
                        <tr><td class="label">군번</td><td>${user.serviceNumber || "-"}</td><td class="label">소속</td><td>${user.unit || "-"}</td></tr>
                        <tr><td class="label">훈련차수</td><td colspan="3">${rBatch.name}</td></tr>
                        <tr><td class="label">훈련기간</td><td colspan="3">${new Date(rBatch.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(rBatch.endDate).toLocaleDateString("ko-KR")}</td></tr>
                        ${timeLabel ? `<tr><td class="label">${timeLabel}</td><td colspan="3">${parsedContent.date || "-"} ${parsedContent.time || ""}</td></tr>` : ""}
                      </table>
                      <div class="reason-section">
                        <h3>사유</h3>
                        <div class="reason-box">${parsedContent.reason || viewingReport.content}</div>
                      </div>
                      <div class="date-line">${new Date(viewingReport.createdAt).toLocaleDateString("ko-KR")}</div>
                      <div class="signature-area">
                        <p>위 사유서를 제출합니다.</p>
                        <p style="margin-top: 20px;">성명: ${user.name} (인)</p>
                      </div>
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
              let parsed: { reason?: string; date?: string; time?: string } = {};
              try { parsed = JSON.parse(viewingReport.content); } catch { parsed = { reason: viewingReport.content }; }
              return (
                <div className="space-y-3">
                  {(viewingReport.type === "LATE_ARRIVAL" || viewingReport.type === "EARLY_DEPARTURE") && (parsed.date || parsed.time) && (
                    <div className="text-sm">
                      <span className="text-gray-500">{viewingReport.type === "LATE_ARRIVAL" ? "입소 예정:" : "퇴소 예정:"}</span>
                      <span className="ml-2 font-medium">{parsed.date} {parsed.time}</span>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-500 mb-1">사유</p>
                    <p className="text-sm bg-white border rounded-lg p-3 whitespace-pre-wrap">{parsed.reason || viewingReport.content}</p>
                  </div>
                  <p className="text-xs text-gray-400">작성일: {new Date(viewingReport.createdAt).toLocaleString("ko-KR")}</p>
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
                      {REASON_TYPE_LABELS[r.type]} - {new Date(r.updatedAt).toLocaleDateString("ko-KR")}
                    </button>
                  ))}
                </div>
              </div>
            )}
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
              onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {trainingCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveEdit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">저장</button>
              <button onClick={() => setEditingTraining(null)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
