"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
import { ROLE_LABELS, NOTIFICATION_TYPES } from "@/lib/constants";

interface Batch {
  id: string;
  name: string;
}

export default function AdminNotificationsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "GENERAL",
    targetRole: "",
    targetBatchId: "",
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    fetch("/api/batches").then((r) => r.json()).then(setBatches);
  }, []);

  const handleSend = async () => {
    setSending(true);
    setResult("");
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSending(false);
    setResult(data.message || "발송 완료");
  };

  // 빠른 알림 프리셋
  const presets = [
    { label: "훈련 시작 안내", title: "훈련 시작 안내", content: "금일 훈련이 시작됩니다. 지정된 시간까지 집합해주세요.", type: "TRAINING" },
    { label: "훈련 종료 안내", title: "훈련 종료 안내", content: "금일 훈련이 종료되었습니다. 퇴근 처리를 해주세요.", type: "TRAINING" },
    { label: "식사 안내", title: "식사 시간 안내", content: "식사 시간입니다. 급식소로 이동해주세요.", type: "GENERAL" },
    { label: "집합 안내", title: "집합 안내", content: "전원 즉시 집합하여 주시기 바랍니다.", type: "GENERAL" },
  ];

  return (
    <div className="max-w-2xl">
      <PageTitle
        title="푸시 알림 발송"
        description="대상자에게 알림을 발송합니다."
      />

      {/* 빠른 발송 버튼 */}
      <div className="bg-white rounded-xl border p-5 mb-6">
        <h3 className="font-semibold mb-3">빠른 발송</h3>
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => setForm({ ...form, title: p.title, content: p.content, type: p.type })}
              className="p-3 bg-gray-50 rounded-lg text-sm text-left hover:bg-blue-50 hover:border-blue-300 border transition-colors"
            >
              <p className="font-medium">{p.label}</p>
              <p className="text-xs text-gray-400 mt-1 truncate">{p.content}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 발송 폼 */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold">알림 내용</h3>
        <div>
          <label className="block text-sm font-medium mb-1">제목</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">내용</label>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">대상 역할</label>
            <select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="">전체</option>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">대상 차수</label>
            <select value={form.targetBatchId} onChange={(e) => setForm({ ...form, targetBatchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="">전체</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">알림 유형</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
            {Object.entries(NOTIFICATION_TYPES).map(([k, v]) => (
              <option key={k} value={v}>{k}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSend}
          disabled={sending || !form.title || !form.content}
          className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {sending ? "발송 중..." : "알림 발송"}
        </button>

        {result && (
          <p className="text-sm text-center text-green-600 font-medium">{result}</p>
        )}
      </div>
    </div>
  );
}
