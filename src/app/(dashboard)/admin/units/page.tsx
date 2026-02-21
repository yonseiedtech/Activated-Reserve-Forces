"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";

interface Unit {
  id: string;
  name: string;
  description: string | null;
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = () => fetch("/api/units").then((r) => r.json()).then(setUnits);

  const handleCreate = async () => {
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", description: "" });
      fetchUnits();
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditForm({ name: unit.name, description: unit.description || "" });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/units/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setEditingId(null);
      fetchUnits();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("부대를 삭제하시겠습니까?")) return;
    await fetch(`/api/units/${id}`, { method: "DELETE" });
    fetchUnits();
  };

  return (
    <div>
      <PageTitle
        title="부대 관리"
        description="부대 정보를 등록/수정/삭제합니다."
        actions={
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 부대 추가
          </button>
        }
      />

      <div className="space-y-3">
        {units.map((unit) => (
          <div key={unit.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
            {editingId === unit.id ? (
              <div className="flex-1 space-y-2">
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="부대명"
                />
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  placeholder="설명 (선택)"
                />
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">저장</button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50">취소</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold">{unit.name}</h3>
                  {unit.description && <p className="text-sm text-gray-500 mt-1">{unit.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(unit)} className="px-3 py-1 text-blue-600 border border-blue-200 rounded-lg text-sm hover:bg-blue-50">수정</button>
                  <button onClick={() => handleDelete(unit.id)} className="px-3 py-1 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">삭제</button>
                </div>
              </>
            )}
          </div>
        ))}
        {units.length === 0 && <p className="text-center py-8 text-gray-400">등록된 부대가 없습니다.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">부대 추가</h3>
            <input placeholder="부대명 (예: 00사단 00연대)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="설명 (선택)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">등록</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
