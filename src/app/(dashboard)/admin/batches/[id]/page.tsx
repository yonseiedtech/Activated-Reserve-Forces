"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PageTitle from "@/components/ui/PageTitle";
import { BATCH_STATUS_LABELS, TRAINING_TYPES } from "@/lib/constants";

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
  batchStatus?: string;
  batchReason?: string | null;
}

interface Batch {
  id: string;
  name: string;
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  status: string;
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

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

export default function AdminBatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.id as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [tab, setTab] = useState<"training" | "trainees" | "attendance">("training");
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showTrainingForm, setShowTrainingForm] = useState(false);
  const [trainingFormDate, setTrainingFormDate] = useState("");
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

  useEffect(() => {
    fetchBatch();
    fetchInstructors();
    fetchUnassigned();
  }, [fetchBatch, fetchInstructors, fetchUnassigned]);

  useEffect(() => {
    if (tab === "attendance") fetchAttendanceSummary();
  }, [tab, fetchAttendanceSummary]);

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

  if (!batch) return <div className="text-center py-8 text-gray-400">로딩 중...</div>;

  const dateRange = getDateRange(batch.startDate, batch.endDate);
  const trainingsByDate: Record<string, Training[]> = {};
  for (const d of dateRange) trainingsByDate[d] = [];
  for (const t of batch.trainings) {
    const dateKey = new Date(t.date).toISOString().split("T")[0];
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
        description={
          `${new Date(batch.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(batch.endDate).toLocaleDateString("ko-KR")} | ${batch._count.users}명 | ${batch._count.trainings}개 훈련`
        }
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
      </div>

      {/* Training Plan Tab */}
      {tab === "training" && (
        <div className="space-y-4">
          {dateRange.map((date) => {
            const dayTrainings = trainingsByDate[date] || [];
            const d = new Date(date);
            const dayLabel = d.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });

            return (
              <div key={date} className="bg-white rounded-xl border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-semibold text-sm">{dayLabel}</h3>
                  <button
                    onClick={() => handleAddTraining(date)}
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
          })}
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
        <div className="space-y-3">
          {attendanceLoading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : (
            <>
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
            </>
          )}
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
              {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
              {TRAINING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
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
