"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_ORDER } from "@/lib/constants";

interface Payment {
  id: string;
  batchId: string;
  title: string;
  amount: number | null;
  bankInfo: string | null;
  status: string;
  docDraftAt: string | null;
  docApprovedAt: string | null;
  cmsDraftAt: string | null;
  cmsApprovedAt: string | null;
  note: string | null;
  batch: { name: string };
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ batchId: "", title: "", amount: 0, bankInfo: "", note: "" });

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  useEffect(() => {
    fetch("/api/payments").then((r) => r.json()).then(setPayments);
    if (isAdmin) fetch("/api/batches").then((r) => r.json()).then(setBatches);
  }, [isAdmin]);

  const handleCreate = async () => {
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      fetch("/api/payments").then((r) => r.json()).then(setPayments);
    }
  };

  const handleAdvance = async (id: string) => {
    const res = await fetch(`/api/payments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    if (res.ok) {
      fetch("/api/payments").then((r) => r.json()).then(setPayments);
    }
  };

  return (
    <div>
      <PageTitle
        title="훈련비 관리"
        description="훈련비 입금 절차를 관리합니다."
        actions={
          isAdmin ? (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + 새 프로세스
            </button>
          ) : undefined
        }
      />

      <div className="space-y-4">
        {payments.map((p) => {
          const currentIndex = PAYMENT_STATUS_ORDER.indexOf(p.status as typeof PAYMENT_STATUS_ORDER[number]);
          const isLast = currentIndex >= PAYMENT_STATUS_ORDER.length - 1;

          return (
            <div key={p.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="text-sm text-gray-500">{p.batch.name}</p>
                </div>
                {p.amount && (
                  <p className="text-lg font-bold text-blue-600">{p.amount.toLocaleString()}원</p>
                )}
              </div>

              {/* 진행 상태 바 */}
              <div className="flex items-center gap-1 mb-4">
                {PAYMENT_STATUS_ORDER.map((status, i) => {
                  const done = i <= currentIndex;
                  return (
                    <div key={status} className="flex-1">
                      <div className={`h-2 rounded-full ${done ? "bg-blue-600" : "bg-gray-200"}`} />
                      <p className={`text-xs mt-1 text-center ${done ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                        {PAYMENT_STATUS_LABELS[status]}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* 일시 정보 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 mb-3">
                {p.docDraftAt && <span>공문 상신: {new Date(p.docDraftAt).toLocaleDateString("ko-KR")}</span>}
                {p.docApprovedAt && <span>공문 결재: {new Date(p.docApprovedAt).toLocaleDateString("ko-KR")}</span>}
                {p.cmsDraftAt && <span>CMS 상신: {new Date(p.cmsDraftAt).toLocaleDateString("ko-KR")}</span>}
                {p.cmsApprovedAt && <span>입금 완료: {new Date(p.cmsApprovedAt).toLocaleDateString("ko-KR")}</span>}
              </div>

              {p.bankInfo && <p className="text-sm text-gray-600 mb-2">계좌: {p.bankInfo}</p>}
              {p.note && <p className="text-sm text-gray-400">{p.note}</p>}

              {isAdmin && !isLast && (
                <button
                  onClick={() => handleAdvance(p.id)}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  다음 단계로 진행
                </button>
              )}
            </div>
          );
        })}

        {payments.length === 0 && (
          <p className="text-center py-8 text-gray-400">등록된 훈련비 프로세스가 없습니다.</p>
        )}
      </div>

      {/* 생성 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">훈련비 프로세스 생성</h3>
            <div>
              <label className="block text-sm font-medium mb-1">차수</label>
              <select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">제목</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">금액 (원)</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">계좌 정보</label>
                <input value={form.bankInfo} onChange={(e) => setForm({ ...form, bankInfo: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="은행 계좌번호" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">비고</label>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">생성 (공문 상신)</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
