"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  requiredHours: number | null;
  startTime: string | null;
  endTime: string | null;
  unitId: string | null;
  _count: { users: number; trainings: number };
}

interface UnitOption {
  id: string;
  name: string;
}

interface BatchFormData {
  unitId: string;
  year: number;
  number: number;
  name: string;
  isMultiDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  requiredHours: string;
}

const defaultForm: BatchFormData = {
  unitId: "",
  year: 2026,
  number: 1,
  name: "",
  isMultiDay: false,
  startDate: "",
  endDate: "",
  startTime: "08:30",
  endTime: "17:30",
  location: "",
  requiredHours: "",
};

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BatchFormData>({ ...defaultForm });

  // Edit state
  const [editTarget, setEditTarget] = useState<Batch | null>(null);
  const [editForm, setEditForm] = useState<BatchFormData>({ ...defaultForm });
  const [editLoading, setEditLoading] = useState(false);

  // Duplicate state
  const [duplicateTarget, setDuplicateTarget] = useState<Batch | null>(null);
  const [dupForm, setDupForm] = useState<BatchFormData>({ ...defaultForm });
  const [dupLoading, setDupLoading] = useState(false);

  useEffect(() => {
    fetchBatches();
    fetch("/api/units").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setUnits(data);
    }).catch(() => {});
  }, []);

  const fetchBatches = () => fetch("/api/batches").then((r) => r.json()).then(setBatches);

  const formToPayload = (f: BatchFormData) => ({
    name: f.name,
    year: f.year,
    number: f.number,
    startDate: f.startDate,
    endDate: f.isMultiDay ? f.endDate : f.startDate,
    location: f.location || null,
    requiredHours: f.requiredHours,
    startTime: f.startTime || null,
    endTime: f.endTime || null,
    unitId: f.unitId || null,
  });

  const handleCreate = async () => {
    const res = await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(form)),
    });
    if (res.ok) { setShowForm(false); setForm({ ...defaultForm }); fetchBatches(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("차수를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/batches/${id}`, { method: "DELETE" });
    if (res.ok) {
      alert("삭제 완료되었습니다.");
      fetchBatches();
    } else {
      const data = await res.json();
      alert(data.error || "삭제에 실패했습니다.");
    }
  };

  const handleEditOpen = (batch: Batch) => {
    const sameDay = batch.startDate.split("T")[0] === batch.endDate.split("T")[0];
    setEditTarget(batch);
    setEditForm({
      unitId: batch.unitId || "",
      name: batch.name,
      year: batch.year,
      number: batch.number,
      isMultiDay: !sameDay,
      startDate: batch.startDate.split("T")[0],
      endDate: batch.endDate.split("T")[0],
      startTime: batch.startTime || "08:30",
      endTime: batch.endTime || "17:30",
      location: batch.location || "",
      requiredHours: batch.requiredHours != null ? String(batch.requiredHours) : "",
    });
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    const res = await fetch(`/api/batches/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(editForm)),
    });
    setEditLoading(false);
    if (res.ok) {
      setEditTarget(null);
      fetchBatches();
    } else {
      alert("수정에 실패했습니다.");
    }
  };

  const handleDuplicateOpen = (batch: Batch) => {
    setDuplicateTarget(batch);
    setDupForm({
      unitId: batch.unitId || "",
      name: `${batch.name} (복제)`,
      year: batch.year,
      number: batch.number + 1,
      isMultiDay: batch.startDate.split("T")[0] !== batch.endDate.split("T")[0],
      startDate: "",
      endDate: "",
      startTime: batch.startTime || "08:30",
      endTime: batch.endTime || "17:30",
      location: batch.location || "",
      requiredHours: batch.requiredHours != null ? String(batch.requiredHours) : "",
    });
  };

  const handleDuplicate = async () => {
    if (!duplicateTarget) return;
    setDupLoading(true);
    const res = await fetch(`/api/batches/${duplicateTarget.id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formToPayload(dupForm)),
    });
    setDupLoading(false);
    if (res.ok) {
      setDuplicateTarget(null);
      fetchBatches();
    }
  };

  return (
    <div>
      <PageTitle
        title="차수 관리"
        actions={
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 차수 추가
          </button>
        }
      />

      <div className="space-y-3">
        {batches.map((b) => (
          <div key={b.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
            <Link href={`/admin/batches/${b.id}`} className="flex-1 min-w-0">
              <h3 className="font-semibold hover:text-blue-600">{b.name}</h3>
              <p className="text-sm text-gray-500">
                {b.startDate.split("T")[0] === b.endDate.split("T")[0]
                  ? new Date(b.startDate).toLocaleDateString("ko-KR")
                  : `${new Date(b.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(b.endDate).toLocaleDateString("ko-KR")}`
                } | {b._count.users}명 | {b._count.trainings}개 훈련
              </p>
              {(b.location || b.requiredHours != null || b.startTime) && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {b.location}{b.location && (b.requiredHours != null || b.startTime) && " · "}
                  {b.requiredHours != null && `부과시간 ${b.requiredHours}시간`}
                  {b.requiredHours != null && b.startTime && " · "}
                  {b.startTime && `${b.startTime}~${b.endTime || ""}`}
                </p>
              )}
            </Link>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                {BATCH_STATUS_LABELS[b.status] || b.status}
              </span>
              <button onClick={() => handleEditOpen(b)} className="px-3 py-1 text-gray-600 border border-gray-200 rounded text-sm hover:bg-gray-50">수정</button>
              <button onClick={() => handleDuplicateOpen(b)} className="px-3 py-1 text-blue-600 border border-blue-200 rounded text-sm hover:bg-blue-50">복제</button>
              <button onClick={() => handleDelete(b.id)} className="px-3 py-1 text-red-600 border border-red-200 rounded text-sm hover:bg-red-50">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {/* 차수 추가 모달 */}
      {showForm && (
        <BatchFormModal
          title="차수 추가"
          form={form}
          setForm={setForm}
          units={units}
          onSubmit={handleCreate}
          onClose={() => { setShowForm(false); setForm({ ...defaultForm }); }}
          submitLabel="생성"
        />
      )}

      {/* 차수 수정 모달 */}
      {editTarget && (
        <BatchFormModal
          title="차수 수정"
          form={editForm}
          setForm={setEditForm}
          units={units}
          onSubmit={handleEdit}
          onClose={() => setEditTarget(null)}
          submitLabel={editLoading ? "저장 중..." : "저장"}
          disabled={editLoading}
        />
      )}

      {/* 차수 복제 모달 */}
      {duplicateTarget && (
        <BatchFormModal
          title="차수 복제"
          subtitle={`"${duplicateTarget.name}"의 훈련 과목을 복제합니다. (대상자 제외)`}
          form={dupForm}
          setForm={setDupForm}
          units={units}
          onSubmit={handleDuplicate}
          onClose={() => setDuplicateTarget(null)}
          submitLabel={dupLoading ? "복제 중..." : "복제"}
          disabled={dupLoading}
        />
      )}
    </div>
  );
}

// ── 공통 차수 폼 모달 ──
function BatchFormModal({
  title,
  subtitle,
  form,
  setForm,
  units,
  onSubmit,
  onClose,
  submitLabel = "생성",
  disabled = false,
}: {
  title: string;
  subtitle?: string;
  form: BatchFormData;
  setForm: React.Dispatch<React.SetStateAction<BatchFormData>>;
  units: UnitOption[];
  onSubmit: () => void;
  onClose: () => void;
  submitLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}

        {/* 훈련 부대 선택 */}
        <div>
          <label className="text-sm font-medium">훈련 부대</label>
          <select
            value={form.unitId}
            onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg mt-1"
          >
            <option value="">부대 선택</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        {/* 연도 + 차수 번호 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">연도</label>
            <input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: parseInt(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">차수 번호</label>
            <input type="number" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: parseInt(e.target.value) }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
          </div>
        </div>

        {/* 차수명 */}
        <div>
          <label className="text-sm font-medium">차수명</label>
          <input placeholder="예: 2026년 1차수" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
        </div>

        {/* 기간 체크 */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isMultiDay"
            checked={form.isMultiDay}
            onChange={(e) => setForm((f) => ({ ...f, isMultiDay: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <label htmlFor="isMultiDay" className="text-sm text-gray-700">기간 (2일 이상)</label>
        </div>

        {/* 날짜 */}
        {form.isMultiDay ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">시작일</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">종료일</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium">날짜</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: e.target.value }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
          </div>
        )}

        {/* 시작 시간 / 종료 시간 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">시작 시간</label>
            <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">종료 시간</label>
            <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="w-full px-3 py-2 border rounded-lg mt-1" />
          </div>
        </div>

        {/* 훈련 장소 */}
        <input placeholder="훈련 장소" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />

        {/* 훈련 부과 시간 */}
        <input type="number" placeholder="훈련 부과 시간 (시간)" value={form.requiredHours} onChange={(e) => setForm((f) => ({ ...f, requiredHours: e.target.value }))} className="w-full px-3 py-2 border rounded-lg" />

        <div className="flex gap-3">
          <button onClick={onSubmit} disabled={disabled} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {submitLabel}
          </button>
          <button onClick={onClose} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
        </div>
      </div>
    </div>
  );
}
