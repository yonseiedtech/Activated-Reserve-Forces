"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";
import { PAYMENT_STATUS_LABELS, REFUND_STATUS_LABELS } from "@/lib/constants";

interface SummaryRow {
  batchId: string;
  batchName: string;
  status: string;
  presentCount: number;
  totalAttendance: number;
  totalUsers: number;
  compensationTotal: number;
  transportTotal: number;
  grandTotal: number;
  refundStatus: string | null;
  refundTotal: number;
  startDate?: string;
}

interface SummaryData {
  rows: SummaryRow[];
  summary: {
    pendingTotal: number;
    paidTotal: number;
    allTotal: number;
  };
}

// 예비역 차수 리스트 타입
interface ReservistBatch {
  batchId: string;
  batchName: string;
  startDate: string;
  endDate: string;
  status: string;
  compensationTotal: number;
  transportAmount: number;
  grandTotal: number;
}

// 계좌 현황 타입
interface BankAccountUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  unit: string | null;
  birthDate: string | null;
  bankName: string | null;
  bankAccount: string | null;
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reservistBatches, setReservistBatches] = useState<ReservistBatch[]>([]);

  // 탭 관련
  const [activeTab, setActiveTab] = useState<"payments" | "bank-accounts">("payments");
  const [bankUsers, setBankUsers] = useState<BankAccountUser[]>([]);
  const [bankLoading, setBankLoading] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  useEffect(() => {
    if (!session) return;

    if (!isAdmin) {
      fetch("/api/payments/my-batches")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) setReservistBatches(d);
          setLoading(false);
        })
        .catch(() => setLoading(false));
      return;
    }

    fetch("/api/payments/summary")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [session, isAdmin, router]);

  // 계좌 탭 클릭 시 전체 유저 계좌 로드
  useEffect(() => {
    if (activeTab !== "bank-accounts" || !isAdmin || bankUsers.length > 0) return;
    setBankLoading(true);
    fetch("/api/payments/bank-accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.users) setBankUsers(d.users);
        setBankLoading(false);
      })
      .catch(() => setBankLoading(false));
  }, [activeTab, isAdmin, bankUsers.length]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // 예비역: 차수 리스트 표시
  if (!isAdmin) {
    return (
      <div>
        <PageTitle title="훈련비 현황" description="내 차수별 훈련비 현황을 확인합니다." />
        {reservistBatches.length === 0 ? (
          <p className="text-center py-10 text-gray-400">배정된 차수가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {reservistBatches.map((b) => (
              <div
                key={b.batchId}
                onClick={() => router.push(`/payments/${b.batchId}`)}
                className="bg-white rounded-xl border p-4 hover:shadow-sm cursor-pointer transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{b.batchName}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(b.startDate).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>
                    <p className="text-gray-400">보상비</p>
                    <p className="font-medium text-gray-700">{b.compensationTotal.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-gray-400">교통비</p>
                    <p className="font-medium text-gray-700">{b.transportAmount.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-gray-400">총액</p>
                    <p className="font-semibold text-gray-900">{b.grandTotal.toLocaleString()}원</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="훈련비 관리" description="전체 차수별 훈련비 현황을 확인합니다." />

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "payments"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          훈련비 현황
        </button>
        <button
          onClick={() => setActiveTab("bank-accounts")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "bank-accounts"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          계좌 현황
        </button>
      </div>

      {activeTab === "payments" && (
        <>
          {/* Desktop: 테이블 */}
          <div className="hidden lg:block bg-white rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">상태</th>
                  <th className="text-left px-4 py-3 font-medium">차수</th>
                  <th className="text-right px-4 py-3 font-medium">보상비</th>
                  <th className="text-right px-4 py-3 font-medium">교통비</th>
                  <th className="text-right px-4 py-3 font-medium">총액</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row) => (
                  <tr
                    key={row.batchId}
                    onClick={() => router.push(`/payments/${row.batchId}`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === "CMS_APPROVED"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}>
                          {PAYMENT_STATUS_LABELS[row.status] || row.status}
                        </span>
                        {row.refundStatus && row.refundTotal > 0 && (
                          <span className={`inline-block w-fit px-2 py-0.5 rounded-full text-xs font-medium ${
                            row.refundStatus === "REFUND_COMPLETED"
                              ? "bg-green-100 text-green-700"
                              : "bg-orange-100 text-orange-700"
                          }`}>
                            {REFUND_STATUS_LABELS[row.refundStatus] || row.refundStatus}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.batchName}</td>
                    <td className="px-4 py-3 text-right">{row.compensationTotal.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-right">{row.transportTotal.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-right font-medium">{row.grandTotal.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.rows.length === 0 && (
              <p className="text-center py-8 text-gray-400">등록된 차수가 없습니다.</p>
            )}
          </div>

          {/* Mobile: 카드 리스트 */}
          <div className="lg:hidden space-y-3">
            {data.rows.length === 0 && (
              <p className="text-center py-8 text-gray-400">등록된 차수가 없습니다.</p>
            )}
            {data.rows.map((row) => (
              <div
                key={row.batchId}
                onClick={() => router.push(`/payments/${row.batchId}`)}
                className="bg-white rounded-xl border p-4 hover:shadow-sm cursor-pointer transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{row.batchName}</span>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.status === "CMS_APPROVED"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {PAYMENT_STATUS_LABELS[row.status] || row.status}
                    </span>
                    {row.refundStatus && row.refundTotal > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.refundStatus === "REFUND_COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {REFUND_STATUS_LABELS[row.refundStatus] || row.refundStatus}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <div>
                    <p className="text-gray-400">보상비</p>
                    <p className="font-medium text-gray-700">{row.compensationTotal.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-gray-400">교통비</p>
                    <p className="font-medium text-gray-700">{row.transportTotal.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-gray-400">총액</p>
                    <p className="font-semibold text-gray-900">{row.grandTotal.toLocaleString()}원</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 하단 합계 */}
          {data.rows.length > 0 && (
            <div className="mt-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
              <h2 className="font-semibold mb-3 text-blue-100">전체 합계</h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-200">지급 예정 (미완료)</span>
                  <span className="font-medium">{data.summary.pendingTotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-blue-200">기지급 (결재완료)</span>
                  <span className="font-medium">{data.summary.paidTotal.toLocaleString()}원</span>
                </div>
                <div className="border-t border-blue-400 pt-2 flex justify-between">
                  <span className="font-semibold">총계</span>
                  <span className="text-xl font-bold">{data.summary.allTotal.toLocaleString()}원</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "bank-accounts" && (
        <div>
          {bankLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-green-700">보상금 지급 계좌 현황</h3>
                  <p className="text-xs text-gray-500 mt-0.5">전체 훈련 대상자</p>
                </div>
                <button
                  onClick={() => {
                    const allUsers = bankUsers;
                    const printWin = window.open("", "_blank");
                    if (!printWin) return;
                    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>보상금 지급 계좌 파악</title><style>
                      @page { size: A4; margin: 15mm; }
                      body { font-family: 'Malgun Gothic', sans-serif; font-size: 12px; color: #000; }
                      h1 { text-align: center; font-size: 18px; margin-bottom: 4px; letter-spacing: 8px; }
                      .subtitle { text-align: center; font-size: 13px; margin-bottom: 12px; color: #333; }
                      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                      th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; font-size: 11px; }
                      th { background: #f0f0f0; font-weight: bold; }
                      .notes { font-size: 11px; margin-top: 16px; }
                      .notes p { margin: 4px 0; }
                    </style></head><body>
                      <h1>보상금 지급 계좌 파악</h1>
                      <p class="subtitle">전체 훈련 대상자</p>
                      <table>
                        <thead>
                          <tr><th>번호</th><th>소속예비군중대</th><th>성 명</th><th>은행명</th><th>계좌번호</th><th>생년월일</th></tr>
                        </thead>
                        <tbody>
                          ${allUsers.map((u, i) => `<tr>
                            <td>${i + 1}</td>
                            <td>${u.unit || "-"}</td>
                            <td>${u.rank ? u.rank + " " : ""}${u.name}</td>
                            <td>${u.bankName || ""}</td>
                            <td>${u.bankAccount || ""}</td>
                            <td>${u.birthDate ? new Date(u.birthDate).toLocaleDateString("ko-KR") : "-"}</td>
                          </tr>`).join("")}
                        </tbody>
                      </table>
                      <div class="notes">
                        <p>※ 위 계좌는 본인 명의 계좌만 유효합니다.</p>
                        <p>※ 계좌번호 오기 시 보상금 지급이 지연될 수 있습니다.</p>
                        <p>※ 미입력 인원은 개별 확인 후 보충 바랍니다.</p>
                        <p>※ 본 자료는 보상금 지급 목적으로만 활용됩니다.</p>
                      </div>
                    </body></html>`);
                    printWin.document.close();
                    printWin.print();
                  }}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                >
                  인쇄
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-2 font-medium text-xs text-gray-500">번호</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-gray-500">소속</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-gray-500">성명</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-gray-500">은행명</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-gray-500">계좌번호</th>
                      <th className="text-left px-4 py-2 font-medium text-xs text-gray-500">생년월일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {bankUsers.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-6 text-gray-400">훈련 대상자가 없습니다.</td></tr>
                    ) : (
                      bankUsers.map((u, i) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2">{u.unit || "-"}</td>
                          <td className="px-4 py-2">{u.rank ? `${u.rank} ` : ""}{u.name}</td>
                          <td className="px-4 py-2">{u.bankName || <span className="text-gray-300">미입력</span>}</td>
                          <td className="px-4 py-2 font-mono text-xs">{u.bankAccount || <span className="text-gray-300 font-sans">미입력</span>}</td>
                          <td className="px-4 py-2">{u.birthDate ? new Date(u.birthDate).toLocaleDateString("ko-KR") : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
                입력 완료: {bankUsers.filter((u) => u.bankName && u.bankAccount).length} / {bankUsers.length}명
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
