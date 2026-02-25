"use client";

import { useEffect, useState } from "react";

interface Category {
  id: string;
  name: string;
  order: number;
}

export default function CategoryManager() {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCategories = async () => {
    const res = await fetch("/api/training-categories");
    if (res.ok) setCategories(await res.json());
  };

  useEffect(() => {
    if (open) fetchCategories();
  }, [open]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError("");
    setLoading(true);
    const res = await fetch("/api/training-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      await fetchCategories();
    } else {
      const data = await res.json();
      setError(data.error || "추가 실패");
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setError("");
    const res = await fetch(`/api/training-categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      await fetchCategories();
    } else {
      const data = await res.json();
      setError(data.error || "삭제 실패");
    }
  };

  const handleEditSave = async (id: string) => {
    if (!editName.trim()) return;
    setError("");
    const res = await fetch(`/api/training-categories/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      await fetchCategories();
    } else {
      const data = await res.json();
      setError(data.error || "수정 실패");
    }
  };

  const handleMove = async (id: string, direction: "up" | "down") => {
    const idx = categories.findIndex((c) => c.id === id);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= categories.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const current = categories[idx];
    const target = categories[swapIdx];

    await Promise.all([
      fetch(`/api/training-categories/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: target.order }),
      }),
      fetch(`/api/training-categories/${target.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: current.order }),
      }),
    ]);
    await fetchCategories();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
      >
        카테고리 편집
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">훈련 카테고리 관리</h3>

            {error && (
              <div className="mb-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
            )}

            <div className="space-y-1 mb-4 max-h-72 overflow-y-auto">
              {categories.map((cat, idx) => (
                <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 group">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMove(cat.id, "up")}
                      disabled={idx === 0}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
                    >
                      &#9650;
                    </button>
                    <button
                      onClick={() => handleMove(cat.id, "down")}
                      disabled={idx === categories.length - 1}
                      className="text-gray-400 hover:text-gray-700 disabled:opacity-20 text-xs leading-none"
                    >
                      &#9660;
                    </button>
                  </div>

                  {editingId === cat.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleEditSave(cat.id)}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEditSave(cat.id)}
                        className="text-blue-600 text-xs font-medium hover:text-blue-800"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-400 text-xs hover:text-gray-600"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{cat.name}</span>
                      <button
                        onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                        className="text-gray-400 hover:text-blue-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="text-gray-400 hover:text-red-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="새 카테고리명"
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                onClick={handleAdd}
                disabled={loading || !newName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                추가
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setOpen(false); setError(""); }}
                className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
