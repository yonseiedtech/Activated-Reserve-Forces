"use client";

import { useEffect, useState } from "react";
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
}

export default function MealsPage() {
  const { data: session } = useSession();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ batchId: "", date: "", type: "BREAKFAST", menuInfo: "", headcount: 0 });

  const canEdit = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER" || session?.user?.role === "COOK";

  useEffect(() => {
    fetch("/api/batches").then((r) => r.json()).then((data) => {
      setBatches(data);
      if (data.length > 0) setSelectedBatch(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      fetch(`/api/meals?batchId=${selectedBatch}`).then((r) => r.json()).then(setMeals);
    }
  }, [selectedBatch]);

  const handleSubmit = async () => {
    const res = await fetch("/api/meals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, batchId: selectedBatch }),
    });
    if (res.ok) {
      setShowForm(false);
      fetch(`/api/meals?batchId=${selectedBatch}`).then((r) => r.json()).then(setMeals);
    }
  };

  // 날짜별 그룹핑
  const grouped = meals.reduce<Record<string, Meal[]>>((acc, m) => {
    const d = new Date(m.date).toLocaleDateString("ko-KR");
    if (!acc[d]) acc[d] = [];
    acc[d].push(m);
    return acc;
  }, {});

  return (
    <div>
      <PageTitle
        title="식사 관리"
        description="차수별 식사 메뉴 및 인원을 관리합니다."
        actions={
          canEdit ? (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
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

      {/* 날짜별 식사 목록 */}
      <div className="space-y-4">
        {Object.entries(grouped).map(([date, dayMeals]) => (
          <div key={date} className="bg-white rounded-xl border p-4">
            <h3 className="font-semibold mb-3">{date}</h3>
            <div className="grid sm:grid-cols-3 gap-3">
              {["BREAKFAST", "LUNCH", "DINNER"].map((type) => {
                const meal = dayMeals.find((m) => m.type === type);
                return (
                  <div key={type} className={`p-3 rounded-lg ${meal ? "bg-green-50 border border-green-200" : "bg-gray-50 border border-gray-200"}`}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{MEAL_TYPE_LABELS[type]}</p>
                    {meal ? (
                      <>
                        <p className="text-sm">{meal.menuInfo || "메뉴 미등록"}</p>
                        <p className="text-xs text-gray-400 mt-1">{meal.headcount}명</p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">미등록</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-center py-8 text-gray-400">등록된 식사 정보가 없습니다.</p>
        )}
      </div>

      {/* 등록 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">식사 등록</h3>
            <div>
              <label className="block text-sm font-medium mb-1">날짜</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">식사</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="BREAKFAST">조식</option>
                <option value="LUNCH">중식</option>
                <option value="DINNER">석식</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">메뉴</label>
              <textarea value={form.menuInfo} onChange={(e) => setForm({ ...form, menuInfo: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg resize-none" placeholder="메뉴를 입력하세요" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">인원</label>
              <input type="number" value={form.headcount} onChange={(e) => setForm({ ...form, headcount: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">저장</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
