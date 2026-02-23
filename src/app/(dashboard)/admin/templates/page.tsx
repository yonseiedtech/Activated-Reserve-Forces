"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";

interface TemplateItem {
  id?: string;
  title: string;
  type?: string;
  startTime: string;
  endTime: string;
  instructor: string;
  location: string;
  description: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  items: TemplateItem[];
  createdAt: string;
}

interface Batch {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

const EMPTY_ITEM: TemplateItem = {
  title: "",
  startTime: "",
  endTime: "",
  instructor: "",
  location: "",
  description: "",
};

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  // 생성/편집 모달
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formItems, setFormItems] = useState<TemplateItem[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  // 적용 모달
  const [applyTarget, setApplyTarget] = useState<Template | null>(null);
  const [applyBatchId, setApplyBatchId] = useState("");
  const [applyDate, setApplyDate] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchBatches();
  }, []);

  const fetchTemplates = () =>
    fetch("/api/trainings/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      });

  const fetchBatches = () =>
    fetch("/api/batches")
      .then((r) => r.json())
      .then(setBatches);

  // --- 생성/편집 ---
  const openCreateForm = () => {
    setEditingId(null);
    setFormName("");
    setFormDesc("");
    setFormItems([{ ...EMPTY_ITEM }]);
    setShowForm(true);
  };

  const openEditForm = (t: Template) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormDesc(t.description || "");
    setFormItems(
      t.items.map((item) => ({
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        instructor: item.instructor || "",
        location: item.location || "",
        description: item.description || "",
      }))
    );
    setShowForm(true);
  };

  const updateItem = (idx: number, field: keyof TemplateItem, value: string) => {
    setFormItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setFormItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (idx: number) => {
    if (formItems.length <= 1) return;
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!formName.trim()) return alert("템플릿 이름을 입력해주세요.");
    const validItems = formItems.filter((i) => i.title && i.startTime && i.endTime);
    if (validItems.length === 0) return alert("최소 1개의 완성된 항목이 필요합니다.");

    // 시간순 정렬
    const sorted = [...validItems].sort((a, b) => a.startTime.localeCompare(b.startTime));

    setSaving(true);
    const url = editingId
      ? `/api/trainings/templates/${editingId}`
      : "/api/trainings/templates";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: formName, description: formDesc || null, items: sorted }),
    });

    if (res.ok) {
      setShowForm(false);
      fetchTemplates();
    } else {
      const err = await res.json();
      alert(err.error || "저장 실패");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 템플릿을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/trainings/templates/${id}`, { method: "DELETE" });
    if (res.ok) fetchTemplates();
    else alert("삭제 실패");
  };

  // --- 적용 ---
  const openApplyModal = (t: Template) => {
    setApplyTarget(t);
    setApplyBatchId("");
    setApplyDate("");
  };

  // 차수 선택 시 날짜 자동 반영
  const handleBatchChange = (batchId: string) => {
    setApplyBatchId(batchId);
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      if (batch) {
        // startDate를 YYYY-MM-DD 형식으로 설정
        const d = new Date(batch.startDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        setApplyDate(`${yyyy}-${mm}-${dd}`);
      }
    } else {
      setApplyDate("");
    }
  };

  // 선택된 차수의 날짜 범위
  const getSelectedBatchRange = () => {
    if (!applyBatchId) return null;
    const batch = batches.find((b) => b.id === applyBatchId);
    if (!batch) return null;
    const fmt = (d: string) => {
      const date = new Date(d);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    };
    return { min: fmt(batch.startDate), max: fmt(batch.endDate), name: batch.name };
  };

  const handleApply = async () => {
    if (!applyTarget || !applyBatchId || !applyDate) return alert("차수와 날짜를 선택해주세요.");
    setApplying(true);

    const res = await fetch(`/api/trainings/templates/${applyTarget.id}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId: applyBatchId, date: applyDate }),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`${data.count}개 훈련이 생성되었습니다.`);
      setApplyTarget(null);
    } else {
      alert(data.error || "적용 실패");
    }
    setApplying(false);
  };

  // --- 유틸 ---
  const calcItemMinutes = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  };

  const totalMinutes = (items: TemplateItem[]) =>
    items.reduce((sum, item) => sum + calcItemMinutes(item.startTime, item.endTime), 0);

  const formatMinutes = (m: number) => {
    if (m <= 0) return "-";
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? (min > 0 ? `${h}시간 ${min}분` : `${h}시간`) : `${min}분`;
  };

  if (loading) return <div className="p-6 text-center text-gray-400">불러오는 중...</div>;

  const batchRange = getSelectedBatchRange();

  return (
    <div>
      <PageTitle
        title="훈련 템플릿"
        description="반복 사용할 훈련 시간표를 관리합니다."
        actions={
          <button
            onClick={openCreateForm}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            + 새 템플릿
          </button>
        }
      />

      {/* 목록 */}
      {templates.length === 0 ? (
        <p className="text-gray-400 text-center py-12">등록된 템플릿이 없습니다.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  {t.description && (
                    <p className="text-sm text-gray-500 mt-1">{t.description}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-600 space-y-1">
                <p>항목 {t.items.length}개 · 총 {formatMinutes(totalMinutes(t.items))}</p>
                {t.items.slice(0, 3).map((item, i) => (
                  <p key={i} className="text-xs text-gray-400">
                    {item.startTime}~{item.endTime} {item.title}
                  </p>
                ))}
                {t.items.length > 3 && (
                  <p className="text-xs text-gray-400">외 {t.items.length - 3}개...</p>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => openApplyModal(t)}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  적용
                </button>
                <button
                  onClick={() => openEditForm(t)}
                  className="flex-1 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  편집
                </button>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="py-2 px-3 text-red-500 border border-red-200 rounded-lg text-sm hover:bg-red-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 생성/편집 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {editingId ? "템플릿 편집" : "새 템플릿"}
            </h3>

            <div className="space-y-3">
              <input
                placeholder="템플릿 이름 (예: 1일차 기본 시간표)"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <input
                placeholder="설명 (선택)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">훈련 항목</h4>
                <button
                  onClick={addItem}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + 항목 추가
                </button>
              </div>

              {formItems.map((item, idx) => {
                const itemMin = calcItemMinutes(item.startTime, item.endTime);
                return (
                  <div key={idx} className="border rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-500">항목 {idx + 1}</span>
                      {formItems.length > 1 && (
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="time"
                        value={item.startTime}
                        onChange={(e) => updateItem(idx, "startTime", e.target.value)}
                        className="px-2 py-1.5 border rounded text-sm"
                      />
                      <input
                        type="time"
                        value={item.endTime}
                        onChange={(e) => updateItem(idx, "endTime", e.target.value)}
                        className="px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    {itemMin > 0 && (
                      <p className="text-xs text-blue-600 font-medium">{formatMinutes(itemMin)}</p>
                    )}
                    <input
                      placeholder="훈련명"
                      value={item.title}
                      onChange={(e) => updateItem(idx, "title", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                    <input
                      placeholder="통제관/교관 (선택)"
                      value={item.instructor}
                      onChange={(e) => updateItem(idx, "instructor", e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="장소 (선택)"
                        value={item.location}
                        onChange={(e) => updateItem(idx, "location", e.target.value)}
                        className="px-2 py-1.5 border rounded text-sm"
                      />
                      <input
                        placeholder="설명 (선택)"
                        value={item.description}
                        onChange={(e) => updateItem(idx, "description", e.target.value)}
                        className="px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                  </div>
                );
              })}

              {/* 전체 산출 시간 */}
              {formItems.length > 0 && totalMinutes(formItems) > 0 && (
                <div className="text-right text-sm font-medium text-gray-700">
                  총 {formatMinutes(totalMinutes(formItems))}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "저장 중..." : editingId ? "수정" : "생성"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 적용 모달 */}
      {applyTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-semibold">템플릿 적용</h3>
            <p className="text-sm text-gray-500">
              &quot;{applyTarget.name}&quot; 템플릿을 선택한 차수/날짜에 적용합니다.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">차수</label>
                <select
                  value={applyBatchId}
                  onChange={(e) => handleBatchChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">차수 선택</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
                <input
                  type="date"
                  value={applyDate}
                  onChange={(e) => setApplyDate(e.target.value)}
                  min={batchRange?.min}
                  max={batchRange?.max}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                {batchRange && (
                  <p className="text-xs text-gray-400 mt-1">
                    {batchRange.name} 기간: {batchRange.min} ~ {batchRange.max}
                  </p>
                )}
              </div>
            </div>

            {/* 미리보기 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">적용될 항목 ({applyTarget.items.length}개)</h4>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">시간</th>
                      <th className="px-3 py-2 text-left">훈련명</th>
                      <th className="px-3 py-2 text-left">통제관/교관</th>
                      <th className="px-3 py-2 text-left">장소</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {applyTarget.items.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 whitespace-nowrap">{item.startTime}~{item.endTime}</td>
                        <td className="px-3 py-2">{item.title}</td>
                        <td className="px-3 py-2 text-gray-500">{item.instructor || "-"}</td>
                        <td className="px-3 py-2 text-gray-500">{item.location || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleApply}
                disabled={applying || !applyBatchId || !applyDate}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {applying ? "적용 중..." : `${applyTarget.items.length}개 훈련 생성`}
              </button>
              <button
                onClick={() => setApplyTarget(null)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
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
