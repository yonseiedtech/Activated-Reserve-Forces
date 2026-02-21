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
  _count: { users: number; trainings: number };
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", year: 2026, number: 1, startDate: "", endDate: "" });

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = () => fetch("/api/batches").then((r) => r.json()).then(setBatches);

  const handleCreate = async () => {
    const res = await fetch("/api/batches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); fetchBatches(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("차수를 삭제하시겠습니까?")) return;
    await fetch(`/api/batches/${id}`, { method: "DELETE" });
    fetchBatches();
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
                {new Date(b.startDate).toLocaleDateString("ko-KR")} ~ {new Date(b.endDate).toLocaleDateString("ko-KR")} | {b._count.users}명 | {b._count.trainings}개 훈련
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                {BATCH_STATUS_LABELS[b.status] || b.status}
              </span>
              <button onClick={() => handleDelete(b.id)} className="px-3 py-1 text-red-600 border border-red-200 rounded text-sm hover:bg-red-50">삭제</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">차수 추가</h3>
            <input placeholder="차수명 (예: 2026년 1차수)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <input type="number" placeholder="연도" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
              <input type="number" placeholder="차수 번호" value={form.number} onChange={(e) => setForm({ ...form, number: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">시작일</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-sm font-medium">종료일</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">생성</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
