"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import PageTitle from "@/components/ui/PageTitle";
import { PAYMENT_STATUS_LABELS, PAYMENT_STATUS_ORDER, REFUND_STATUS_ORDER, REFUND_STATUS_LABELS } from "@/lib/constants";

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

interface CompensationByUserRow extends CompensationRow {
  userId: string;
  userName: string;
  rank: string;
  serviceNumber: string;
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

interface RefundProcess {
  id: string;
  batchId: string;
  status: string;
  reason: string | null;
  compensationRefund: number;
  transportRefund: number;
  refundRequestedAt: string | null;
  depositConfirmedAt: string | null;
  refundCompletedAt: string | null;
  note: string | null;
}

interface PaymentData {
  process: PaymentProcess | null;
  compensations: CompensationRow[];
  compensationsByUser?: CompensationByUserRow[];
  transport: TransportRecord | TransportRecord[] | null;
  batches: { id: string; name: string }[];
  batchId: string;
  batchName: string;
  requiredHours: number | null;
}

export default function PaymentDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;

  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"payment" | "refund">("payment");

  // Refund state
  const [refund, setRefund] = useState<RefundProcess | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";
  const isReservist = session?.user?.role === "RESERVIST";

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/payments?batchId=${batchId}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }, [batchId]);

  const isPaymentCompleted = data?.process?.status === "CMS_APPROVED";

  const fetchRefund = useCallback(async () => {
    if (!isAdmin) return;
    setRefundLoading(true);
    try {
      const res = await fetch(`/api/refunds?batchId=${batchId}`);
      if (res.ok) {
        const d = await res.json();
        setRefund(d);
      }
    } catch { /* ignore */ }
    setRefundLoading(false);
  }, [batchId, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isPaymentCompleted) {
      fetchRefund();
    }
  }, [isPaymentCompleted, fetchRefund]);

  // 입금 미완료 시 refund 탭에서 자동 전환
  useEffect(() => {
    if (tab === "refund" && !isPaymentCompleted) {
      setTab("payment");
    }
  }, [tab, isPaymentCompleted]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const totalCompensation = data.compensationsByUser
    ? data.compensationsByUser.reduce((sum, c) => sum + c.finalRate, 0)
    : data.compensations.reduce((sum, c) => sum + c.finalRate, 0);

  let myTransport = 0;
  let myTransportAddress = "";
  if (isReservist && data.transport && !Array.isArray(data.transport)) {
    myTransport = data.transport.amount;
    myTransportAddress = data.transport.address || "";
  }
  const totalTransports = Array.isArray(data.transport)
    ? (data.transport as TransportRecord[])
    : [];

  const batchName = data.batches.find((b) => b.id === batchId)?.name || "";

  return (
    <div>
      <PageTitle
        title={batchName ? `${batchName} 훈련비` : "훈련비 상세"}
        description="입금 절차 및 보상비를 확인합니다."
        actions={
          <button
            onClick={() => router.push("/payments")}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            ← 목록으로
          </button>
        }
      />

      {/* 탭 (관리자 + 입금완료 시에만 환수 탭 표시) */}
      {isAdmin && isPaymentCompleted && (
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("payment")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "payment" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-800"}`}
          >
            지급내역
          </button>
          <button
            onClick={() => setTab("refund")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "refund" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-800"}`}
          >
            환수내역
          </button>
        </div>
      )}

      {/* ═════════ 지급내역 탭 ═════════ */}
      {tab === "payment" && (
        <div className="space-y-6">
          {data.process && (
            <PaymentProcessSection
              process={data.process}
              isAdmin={isAdmin}
              onUpdate={fetchData}
            />
          )}

          <CompensationSection
            compensations={data.compensations}
            compensationsByUser={data.compensationsByUser}
            total={totalCompensation}
            isAdmin={isAdmin}
            batchId={batchId}
            onSync={fetchData}
            batchName={data.batchName || batchName}
            requiredHours={data.requiredHours}
          />

          {/* 교통비 섹션 - 기능 일시 비활성화 */}

          <SummarySection
            totalCompensation={totalCompensation}
            transportAmount={0}
            isReservist={isReservist}
            personnelCount={isAdmin ? totalTransports.length : undefined}
            refund={refund}
          />
        </div>
      )}

      {/* ═════════ 환수내역 탭 ═════════ */}
      {tab === "refund" && isAdmin && (
        <RefundSection
          refund={refund}
          loading={refundLoading}
          onUpdate={fetchRefund}
          batchId={batchId}
        />
      )}
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
  const [reverting, setReverting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [bankInfo, setBankInfo] = useState(process.bankInfo || "");
  const [note, setNote] = useState(process.note || "");

  const currentIndex = PAYMENT_STATUS_ORDER.indexOf(process.status as typeof PAYMENT_STATUS_ORDER[number]);
  const isLast = currentIndex >= PAYMENT_STATUS_ORDER.length - 1;
  const isFirst = currentIndex <= 0;

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

  const handleRevert = async () => {
    setReverting(true);
    await fetch(`/api/payments/${process.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revert" }),
    });
    setReverting(false);
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

      {isAdmin && !editMode && (
        <div className="mt-2 flex gap-2">
          {!isFirst && (
            <button
              onClick={handleRevert}
              disabled={reverting}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {reverting ? "처리 중..." : "이전 단계로"}
            </button>
          )}
          {!isLast && (
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {advancing ? "처리 중..." : `다음 단계로 (${PAYMENT_STATUS_LABELS[PAYMENT_STATUS_ORDER[currentIndex + 1]]})`}
            </button>
          )}
        </div>
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
  compensationsByUser,
  total,
  isAdmin,
  batchId,
  onSync,
  batchName,
  requiredHours,
}: {
  compensations: CompensationRow[];
  compensationsByUser?: CompensationByUserRow[];
  total: number;
  isAdmin: boolean;
  batchId: string;
  onSync: () => void;
  batchName: string;
  requiredHours: number | null;
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

      <div className="overflow-x-auto">
        {isAdmin && compensationsByUser ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-3 font-medium">대상자</th>
                <th className="pb-2 pr-3 font-medium">유형</th>
                <th className="pb-2 pr-3 font-medium">차수</th>
                <th className="pb-2 pr-3 font-medium">날짜</th>
                <th className="pb-2 pr-3 font-medium text-right">부여시간</th>
                <th className="pb-2 pr-3 font-medium text-right">지급기준액</th>
                <th className="pb-2 pr-3 font-medium text-right">이수시간</th>
                <th className="pb-2 pr-3 font-medium text-right">감액</th>
                <th className="pb-2 font-medium text-right">산출액</th>
              </tr>
            </thead>
            <tbody>
              {compensationsByUser.map((c, i) => {
                const d = new Date(c.date);
                const dateStr = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
                const deduction = c.dailyRate - c.finalRate;
                return (
                  <tr key={`${c.trainingId}-${c.userId}-${i}`} className="border-b border-gray-50">
                    <td className="py-2.5 pr-3 text-gray-800 whitespace-nowrap text-xs">{c.rank} {c.userName}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        c.isWeekend ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-700"
                      }`}>
                        {c.isWeekend ? "주말" : "평일"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-gray-600 text-xs whitespace-nowrap">{batchName}</td>
                    <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{dateStr}</td>
                    <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">
                      {requiredHours != null ? fmtHours(requiredHours) : "-"}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">{c.dailyRate.toLocaleString()}원</td>
                    <td className="py-2.5 pr-3 text-right text-gray-600 whitespace-nowrap">{fmtHours(c.trainingHours)}</td>
                    <td className="py-2.5 pr-3 text-right whitespace-nowrap">
                      {deduction > 0 ? (
                        <span className="text-red-500">-{deduction.toLocaleString()}원</span>
                      ) : "-"}
                    </td>
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
                <td colSpan={8} className="py-3 text-right font-semibold text-gray-700">보상비 합계</td>
                <td className="py-3 text-right font-bold text-blue-700 text-base">
                  {total.toLocaleString()}원
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
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
                        c.isWeekend ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-700"
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
        )}
      </div>

      {((compensationsByUser ? compensationsByUser.length : compensations.length) === 0) && (
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
  const [autoCalcing, setAutoCalcing] = useState(false);
  const [autoCalcError, setAutoCalcError] = useState("");

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

  const handleAutoCalc = async () => {
    setAutoCalcing(true);
    setAutoCalcError("");
    try {
      const res = await fetch("/api/transport-calc/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAutoCalcError(data.error || "자동 계산에 실패했습니다.");
        setAutoCalcing(false);
        return;
      }

      // 계산 성공한 결과를 교통비로 저장
      const calcResults = data.results as { userId: string; address: string | null; calculatedAmount: number | null; status: string }[];
      const recs = calcResults
        .filter((r) => r.status === "OK" && r.calculatedAmount !== null)
        .map((r) => ({
          userId: r.userId,
          amount: r.calculatedAmount!,
          address: r.address || undefined,
        }));

      if (recs.length === 0) {
        setAutoCalcError("계산 가능한 대상자가 없습니다. 대상자의 주소 등록 여부를 확인하세요.");
        setAutoCalcing(false);
        return;
      }

      await fetch("/api/payments/transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, records: recs }),
      });

      // 실패 건수 안내
      const failCount = calcResults.filter((r) => r.status !== "OK").length;
      if (failCount > 0) {
        setAutoCalcError(`${recs.length}명 계산 완료, ${failCount}명 실패 (주소 미등록 또는 경로 조회 불가)`);
      }

      onUpdate();
    } catch {
      setAutoCalcError("자동 계산 중 오류가 발생했습니다.");
    }
    setAutoCalcing(false);
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
        <div className="flex items-center gap-3">
          <button
            onClick={handleAutoCalc}
            disabled={autoCalcing}
            className="text-xs text-green-600 hover:underline disabled:opacity-50"
          >
            {autoCalcing ? "계산 중..." : "자동 계산"}
          </button>
          <button
            onClick={editing ? () => setEditing(false) : startEdit}
            className="text-xs text-blue-600 hover:underline"
          >
            {editing ? "취소" : "수동 편집"}
          </button>
        </div>
      </div>

      {autoCalcError && (
        <div className={`text-xs mb-3 px-3 py-2 rounded-lg ${
          autoCalcError.includes("완료") ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          {autoCalcError}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-3">
        30km 이하 4,000원 / 초과 시 연료비(km×1,486÷13.3)+통행료 자동 산출
      </p>

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
            <p className="text-sm text-gray-400">등록된 교통비가 없습니다. &quot;자동 계산&quot; 또는 &quot;수동 편집&quot;을 이용하세요.</p>
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
  refund,
}: {
  totalCompensation: number;
  transportAmount: number;
  isReservist: boolean;
  personnelCount?: number;
  refund?: RefundProcess | null;
}) {
  const refundTotal = refund ? refund.compensationRefund : 0;
  const grandTotal = totalCompensation - refundTotal;
  const hasRefund = refundTotal > 0;

  return (
    <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
      <h2 className="font-semibold mb-3 text-blue-100">
        {isReservist ? "내 예상 수령액" : hasRefund ? "정산 합계" : "총 합계"}
      </h2>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-blue-200">훈련 보상비</span>
          <span className="font-medium">{totalCompensation.toLocaleString()}원</span>
        </div>
        {/* 교통비 - 기능 일시 비활성화 */}
        {hasRefund && refund && (
          <>
            {refund.compensationRefund > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-orange-300">보상비 환수</span>
                <span className="font-medium text-orange-300">-{refund.compensationRefund.toLocaleString()}원</span>
              </div>
            )}
            {/* 교통비 환수 - 기능 일시 비활성화 */}
          </>
        )}
        <div className="border-t border-blue-400 pt-2 flex justify-between">
          <span className="font-semibold">{isReservist ? "총 예상 수령액" : hasRefund ? "정산 합계" : "총 합계"}</span>
          <span className="text-xl font-bold">{grandTotal.toLocaleString()}원</span>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════
// 환수 내역 섹션
// ═══════════════════════════════════════════════
function RefundSection({
  refund,
  loading,
  onUpdate,
  batchId,
}: {
  refund: RefundProcess | null;
  loading: boolean;
  onUpdate: () => void;
  batchId: string;
}) {
  const [advancing, setAdvancing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [reason, setReason] = useState(refund?.reason || "");
  const [compRefund, setCompRefund] = useState(refund?.compensationRefund || 0);
  const [transRefund, setTransRefund] = useState(refund?.transportRefund || 0);
  const [note, setNote] = useState(refund?.note || "");
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (refund) {
      setReason(refund.reason || "");
      setCompRefund(refund.compensationRefund);
      setTransRefund(refund.transportRefund);
      setNote(refund.note || "");
    }
  }, [refund]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!refund) {
    const handleRequest = async () => {
      setRequesting(true);
      try {
        const res = await fetch("/api/refunds", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || "환수 요청에 실패했습니다.");
        } else {
          onUpdate();
        }
      } catch {
        alert("환수 요청에 실패했습니다.");
      }
      setRequesting(false);
    };

    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-gray-500 text-sm">등록된 환수 내역이 없습니다.</p>
        <button
          onClick={handleRequest}
          disabled={requesting}
          className="px-6 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
        >
          {requesting ? "요청 중..." : "환수 요청"}
        </button>
      </div>
    );
  }

  const currentIndex = REFUND_STATUS_ORDER.indexOf(refund.status as typeof REFUND_STATUS_ORDER[number]);
  const isLast = currentIndex >= REFUND_STATUS_ORDER.length - 1;
  const isFirst = currentIndex <= 0;

  const handleAdvance = async () => {
    setAdvancing(true);
    await fetch(`/api/refunds/${refund.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advance" }),
    });
    setAdvancing(false);
    onUpdate();
  };

  const handleRevert = async () => {
    setReverting(true);
    await fetch(`/api/refunds/${refund.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revert" }),
    });
    setReverting(false);
    onUpdate();
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/refunds/${refund.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason,
        compensationRefund: compRefund,
        transportRefund: transRefund,
        note,
      }),
    });
    setSaving(false);
    setEditMode(false);
    onUpdate();
  };

  const refundTotal = compRefund;

  return (
    <div className="space-y-6">
      {/* 환수 절차 현황 */}
      <section className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">환수 절차 현황</h2>
        </div>

        {/* 3단계 인디케이터 */}
        <div className="flex items-center gap-1 mb-4">
          {REFUND_STATUS_ORDER.map((status, i) => {
            const done = i <= currentIndex;
            const isCurrent = i === currentIndex;
            return (
              <div key={status} className="flex-1">
                <div className={`h-2.5 rounded-full transition-colors ${
                  done ? isCurrent && !isLast ? "bg-orange-500 animate-pulse" : "bg-orange-600" : "bg-gray-200"
                }`} />
                <p className={`text-[11px] mt-1.5 text-center ${
                  done ? "text-orange-700 font-semibold" : "text-gray-400"
                }`}>
                  {REFUND_STATUS_LABELS[status]}
                </p>
              </div>
            );
          })}
        </div>

        {/* 일시 정보 */}
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 mb-3">
          {refund.refundRequestedAt && <span>환수 요청: {fmtDate(refund.refundRequestedAt)}</span>}
          {refund.depositConfirmedAt && <span>입금 확인: {fmtDate(refund.depositConfirmedAt)}</span>}
          {refund.refundCompletedAt && <span>환수 종료: {fmtDate(refund.refundCompletedAt)}</span>}
        </div>

        <div className="flex gap-2">
          {!isFirst && (
            <button
              onClick={handleRevert}
              disabled={reverting}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              {reverting ? "처리 중..." : "이전 단계로"}
            </button>
          )}
          {!isLast && (
            <button
              onClick={handleAdvance}
              disabled={advancing}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
            >
              {advancing ? "처리 중..." : `다음 단계로 (${REFUND_STATUS_LABELS[REFUND_STATUS_ORDER[currentIndex + 1]]})`}
            </button>
          )}
        </div>

        {isLast && (
          <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 font-medium">
            환수 종료
          </div>
        )}
      </section>

      {/* 환수 내역 상세 */}
      <section className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">환수 내역</h2>
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-xs text-blue-600 hover:underline"
          >
            {editMode ? "취소" : "편집"}
          </button>
        </div>

        {!editMode ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">환수 사유</p>
              <p className="text-sm">{refund.reason || "-"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">훈련 보상비 환수</p>
                <p className="text-sm font-medium">{compRefund.toLocaleString()}원</p>
              </div>
            </div>
            {refund.note && (
              <div>
                <p className="text-xs text-gray-500 mb-1">비고</p>
                <p className="text-sm text-gray-600">{refund.note}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">환수 사유</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border rounded-lg resize-none"
                placeholder="환수 사유를 입력하세요"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">훈련 보상비 환수 (원)</label>
                <input
                  type="number"
                  value={compRefund}
                  onChange={(e) => setCompRefund(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-sm border rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">비고</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg"
                placeholder="비고"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}
      </section>

      {/* 환수 합계 */}
      <section className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-5 text-white">
        <h2 className="font-semibold mb-3 text-orange-100">환수 합계</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-orange-200">훈련 보상비 환수</span>
            <span className="font-medium">{compRefund.toLocaleString()}원</span>
          </div>
          <div className="border-t border-orange-400 pt-2 flex justify-between">
            <span className="font-semibold">환수 총액</span>
            <span className="text-xl font-bold">{refundTotal.toLocaleString()}원</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────
// 유틸
// ──────────────────────────────────────
function fmtHours(h: number): string {
  const hours = Math.floor(h);
  const minutes = Math.round((h - hours) * 60);
  if (minutes === 0) return `${hours}시`;
  return `${hours}시 ${minutes}분`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ko-KR");
}
