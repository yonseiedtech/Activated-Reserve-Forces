"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_ORDER } from "@/lib/constants";

interface CompensationRow {
  trainingId: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  trainingHours: number;
  isWeekend: boolean;
  dailyRate: number;
  overrideRate: number | null;
  finalRate: number;
}

interface TransportRecord {
  id?: string;
  userId: string;
  amount: number;
  address: string | null;
  note: string | null;
  user?: { id: string; name: string; rank: string; serviceNumber: string };
}

interface PaymentProcess {
  id: string;
  batchId: string;
  title: string;
  bankInfo: string | null;
  status: string;
  docDraftAt: string | null;
  docApprovedAt: string | null;
  cmsDraftAt: string | null;
  cmsApprovedAt: string | null;
  note: string | null;
}

interface PaymentData {
  process: PaymentProcess | null;
  compensations: CompensationRow[];
  transport: TransportRecord | TransportRecord[] | null;
  batches: { id: string; name: string }[];
  batchId: string;
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<PaymentData | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const isReservist = session?.user?.role === "RESERVIST";

  const fetchData = useCallback(async (batchId?: string) => {
    setLoading(true);
    const qs = batchId ? `?batchId=${batchId}` : "";
    const res = await fetch(`/api/payments${qs}`);
    const d = await res.json();
    setData(d);
    if (d.batchId) setSelectedBatch(d.batchId);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBatchChange = (batchId: string) => {
    setSelectedBatch(batchId);
    fetchData(batchId);
  };

  if (loading || !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalCompensation = data.compensations.reduce((sum, c) => sum + c.finalRate, 0);

  // 교통비 (RESERVIST: 단건 객체, ADMIN: 배열)
  let myTransport = 0;
  let myTransportAddress = "";
  if (isReservist && data.transport && !Array.isArray(data.transport)) {
    myTransport = data.transport.amount;
    myTransportAddress = data.transport.address || "";
  }
  const totalTransports = Array.isArray(data.transport)
    ? (data.transport as TransportRecord[])
    : [];

  return (
    <div>
      <PageTitle title="훈련비 관리" description="차수별 입금 절차 및 보상비를 확인합니다." />

      {/* 차수 선택 (관리자) */}
      {isAdmin && data.batches.length > 0 && (
        <div className="mb-6">
          <div className="flex gap-2 flex-wrap">
            {data.batches.map((b) => (
              <button
                key={b.id}
                onClick={() => handleBatchChange(b.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedBatch === b.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ──────── 섹션 1: 입금 절차 현황 ──────── */}
        {data.process && (
          <PaymentProcessSection
            process={data.process}
            isAdmin={isAdmin}
            onUpdate={() => fetchData(selectedBatch)}
          />
        )}

        {/* ──────── 섹션 2: 훈련 보상비 내역 ──────── */}
        <CompensationSection
          compensations={data.compensations}
          total={totalCompensation}
          isAdmin={isAdmin}
          batchId={selectedBatch}
          onSync={() => fetchData(selectedBatch)}
        />

        {/* ──────── 섹션 3: 교통비 ──────── */}
        {isReservist ? (
          <ReservistTransportSection amount={myTransport} address={myTransportAddress} />
        ) : isAdmin ? (
          <AdminTransportSection
            batchId={selectedBatch}
            records={totalTransports}
            onUpdate={() => fetchData(selectedBatch)}
          />
        ) : null}

        {/* ──────── 섹션 4: 합계 ──────── */}
        <SummarySection
          totalCompensation={totalCompensation}
          transportAmount={isReservist ? myTransport : totalTransports.reduce((s, r) => s + r.amount, 0)}
          isReservist={isReservist}
          personnelCount={isAdmin ? totalTransports.length : undefined}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// 섹션 1: 입금 절차 현황
// ═══════════════════════════════════════════════
function PaymentProcessSection({
  process,
  isAdmin,
  onUpdate,
}: {
  process: PaymentProcess;
  isAdmin: boolean;
  onUpdate: () => void;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bankInfo, setBankInfo] = useState(process.bankInfo || "");
  const [note, setNote] = useState(process.note || "");

  const currentIndex = PAYMENT_STATUS_ORDER.indexOf(process.status as typeof PAYMENT_STATUS_ORDER[number]);
  const isLast = currentIndex >= PAYMENT_STATUS_ORDER.length - 1;

  const handleAdvance = async () => {
    setAdvancing(true);
    await fetch(`/api/payments/${process.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    setAdvancing(false);
    onUpdate();
  };

  const handleSaveInfo = async () => {
    await fetch(`/api/payments/${process.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankInfo, note }),
    });
    setEditMode(false);
    onUpdate();
  };

  return (
    <section className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">입금 절차 현황</h2>
        {isAdmin && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs text-blue-600 hover:underline"
          >
            {editMode ? "취소" : "정보 수정"}
          </button>
        )}
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-1 mb-4">
        {PAYMENT_STATUS_ORDER.map((status, i) => {
          const done = i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <div key={status} className="flex-1">
              <div className={`h-2.5 rounded-full transition-colors ${
                done ? isCurrent && !isLast ? "bg-blue-500 animate-pulse" : "bg-blue-600" : "bg-gray-200"
              }`} />
              <p className={`text-[11px] mt-1.5 text-center ${
                done ? "text-blue-700 font-semibold" : "text-gray-400"
              }`}>
                {PAYMENT_STATUS_LABELS[status]}
              </p>
            </div>
          );
        })}
      </div>

      {/* 일시 정보 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-500 mb-3">
        {process.docDraftAt && <span>공문 상신: {fmtDate(process.docDraftAt)}</span>}
        {process.docApprovedAt && <span>공문 결재: {fmtDate(process.docApprovedAt)}</span>}
        {process.cmsDraftAt && <span>CMS 상신: {fmtDate(process.cmsDraftAt)}</span>}
        {process.cmsApprovedAt && <span>입금 완료: {fmtDate(process.cmsApprovedAt)}</span>}
      </div>

      {process.bankInfo && !editMode && <p className="text-sm text-gray-600 mb-1">계좌: {process.bankInfo}</p>}
      {process.note && !editMode && <p className="text-sm text-gray-400">{process.note}</p>}

      {/* 수정 폼 */}
      {editMode && (
        <div className="space-y-2 mb-3">
          <input
            value={bankInfo}
            onChange={(e) => setBankInfo(e.target.value)}
            placeholder="계좌 정보"
            className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="비고"
            className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveInfo}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            저장
          </button>
        </div>
      )}

      {isAdmin && !isLast && !editMode && (
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {advancing ? "처리 중..." : `다음 단계로 (${PAYMENT_STATUS_LABELS[PAYMENT_STATUS_ORDER[currentIndex + 1]]})`}
        </button>
      )}

      {isLast && (
        <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
          입금 완료
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════
// 섹션 2: 훈련 보상비 내역
// ═══════════════════════════════════════════════
function CompensationSection({
  compensations,
  total,
  isAdmin,
  batchId,
  onSync,
}: {
  compensations: CompensationRow[];
  total: number;
  isAdmin: boolean;
  batchId: string;
  onSync: () => void;
}) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await fetch("/api/payments/sync-compensation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId }),
    });
    setSyncing(false);
    onSync();
  };

  return (
    <section className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">훈련 보상비 내역</h2>
        {isAdmin && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="text-xs text-blue-600 hover:underline disabled:opacity-50"
          >
            {syncing ? "동기화 중..." : "보상비 재계산"}
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-3">
        8시간 기준 — 평일 100,000원 / 주말 150,000원 (시간 비례, 점심시간 제외)
      </p>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500">
              <th className="pb-2 pr-3 font-medium">유형</th>
              <th className="pb-2 pr-3 font-medium">날짜</th>
              <th className="pb-2 pr-3 font-medium">훈련</th>
              <th className="pb-2 pr-3 font-medium text-right">시간</th>
              <th className="pb-2 font-medium text-right">보상비</th>
            </tr>
          </thead>
          <tbody>
            {compensations.map((c) => {
              const d = new Date(c.date);
              const dateStr = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
              return (
                <tr key={c.trainingId} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                      c.isWeekend
                        ? "bg-orange-100 text-orange-700"
                        : "bg-blue-50 text-blue-700"
                    }`}>
                      {c.isWeekend ? "주말" : "평일"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{dateStr}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium text-gray-900">{c.title}</span>
                    {c.startTime && (
                      <span className="text-xs text-gray-400 ml-1.5">{c.startTime}~{c.endTime}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">{c.trainingHours}h</td>
                  <td className="py-2.5 text-right font-medium whitespace-nowrap">
                    {c.overrideRate !== null ? (
                      <span className="text-orange-600" title="관리자 수동 설정">
                        {c.overrideRate.toLocaleString()}원
                      </span>
                    ) : (
                      <span>{c.finalRate.toLocaleString()}원</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200">
              <td colSpan={4} className="py-3 text-right font-semibold text-gray-700">보상비 합계</td>
              <td className="py-3 text-right font-bold text-blue-700 text-base">
                {total.toLocaleString()}원
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {compensations.length === 0 && (
        <p className="text-center py-6 text-gray-400 text-sm">등록된 훈련이 없습니다.</p>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════
// 섹션 3-A: RESERVIST 교통비
// ═══════════════════════════════════════════════
function ReservistTransportSection({ amount, address }: { amount: number; address: string }) {
  return (
    <section className="bg-white rounded-xl border p-5">
      <h2 className="font-semibold text-gray-900 mb-3">교통비</h2>
      {amount > 0 ? (
        <div className="flex items-center justify-between">
          <div>
            {address && <p className="text-sm text-gray-500">기준주소: {address}</p>}
          </div>
          <p className="text-lg font-bold text-blue-600">{amount.toLocaleString()}원</p>
        </div>
      ) : (
        <p className="text-sm text-gray-400">교통비가 아직 등록되지 않았습니다. 관리자에게 문의하세요.</p>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════
// 섹션 3-B: ADMIN 교통비 관리
// ═══════════════════════════════════════════════
function AdminTransportSection({
  batchId,
  records,
  onUpdate,
}: {
  batchId: string;
  records: TransportRecord[];
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string; rank: string; serviceNumber: string }[]>([]);
  const [form, setForm] = useState<Record<string, { amount: string; address: string }>>({});
  const [saving, setSaving] = useState(false);

  // 차수에 속한 전체 사용자 목록 로드
  const startEdit = async () => {
    const res = await fetch(`/api/batches/${batchId}`);
    if (res.ok) {
      const batch = await res.json();
      const batchUsers = batch.users || [];
      setUsers(batchUsers);

      const f: Record<string, { amount: string; address: string }> = {};
      batchUsers.forEach((u: { id: string }) => {
        const existing = records.find((r) => r.userId === u.id);
        f[u.id] = {
          amount: existing ? String(existing.amount) : "",
          address: existing?.address || "",
        };
      });
      setForm(f);
    }
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const recs = Object.entries(form)
      .filter(([, v]) => v.amount !== "")
      .map(([userId, v]) => ({
        userId,
        amount: parseInt(v.amount) || 0,
        address: v.address || undefined,
      }));

    await fetch("/api/payments/transport", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, records: recs }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate();
  };

  const totalTransport = records.reduce((sum, r) => sum + r.amount, 0);

  return (
    <section className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">교통비</h2>
        <button
          onClick={editing ? () => setEditing(false) : startEdit}
          className="text-xs text-blue-600 hover:underline"
        >
          {editing ? "취소" : "교통비 편집"}
        </button>
      </div>

      {!editing ? (
        <>
          {records.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500">
                    <th className="pb-2 font-medium">대상자</th>
                    <th className="pb-2 font-medium">기준주소</th>
                    <th className="pb-2 font-medium text-right">교통비</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.userId} className="border-b border-gray-50">
                      <td className="py-2 text-gray-800">{r.user?.rank} {r.user?.name}</td>
                      <td className="py-2 text-gray-500 text-xs">{r.address || "-"}</td>
                      <td className="py-2 text-right font-medium">{r.amount.toLocaleString()}원</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200">
                    <td colSpan={2} className="py-2 text-right font-semibold text-gray-700">합계</td>
                    <td className="py-2 text-right font-bold text-blue-700">
                      {totalTransport.toLocaleString()}원
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">등록된 교통비가 없습니다. &quot;교통비 편집&quot;을 눌러 입력하세요.</p>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-2">
              <span className="text-sm w-24 shrink-0">{u.rank} {u.name}</span>
              <input
                type="number"
                value={form[u.id]?.amount || ""}
                onChange={(e) => setForm({ ...form, [u.id]: { ...form[u.id], amount: e.target.value } })}
                placeholder="금액"
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                value={form[u.id]?.address || ""}
                onChange={(e) => setForm({ ...form, [u.id]: { ...form[u.id], address: e.target.value } })}
                placeholder="주소"
                className="flex-[2] min-w-0 px-2 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "저장 중..." : "교통비 저장"}
          </button>
        </div>
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════
// 섹션 4: 합계
// ═══════════════════════════════════════════════
function SummarySection({
  totalCompensation,
  transportAmount,
  isReservist,
  personnelCount,
}: {
  totalCompensation: number;
  transportAmount: number;
  isReservist: boolean;
  personnelCount?: number;
}) {
  const grandTotal = totalCompensation + transportAmount;

  return (
    <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
      <h2 className="font-semibold mb-3 text-blue-100">
        {isReservist ? "내 예상 수령액" : "차수 합계"}
      </h2>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-blue-200">훈련 보상비</span>
          <span className="font-medium">{totalCompensation.toLocaleString()}원</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-blue-200">
            교통비
            {!isReservist && personnelCount !== undefined && ` (${personnelCount}명)`}
          </span>
          <span className="font-medium">{transportAmount.toLocaleString()}원</span>
        </div>
        <div className="border-t border-blue-400 pt-2 flex justify-between">
          <span className="font-semibold">{isReservist ? "총 예상 수령액" : "총 합계"}</span>
          <span className="text-xl font-bold">{grandTotal.toLocaleString()}원</span>
        </div>
      </div>
    </section>
  );
}

// ──────────────────────────────────────
// 유틸
// ──────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR");
}
