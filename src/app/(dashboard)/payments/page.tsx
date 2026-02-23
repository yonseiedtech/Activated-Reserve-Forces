"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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
}

interface SummaryData {
  rows: SummaryRow[];
  summary: {
    pendingTotal: number;
    paidTotal: number;
    allTotal: number;
  };
}

export default function PaymentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  useEffect(() => {
    if (!session) return;

    if (!isAdmin) {
      // 대상자: 자기 차수 상세 페이지로 이동
      fetch("/api/payments")
        .then((r) => r.json())
        .then((d) => {
          if (d.batchId) {
            router.replace(`/payments/${d.batchId}`);
          } else {
            setLoading(false);
          }
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

  if (loading || !data) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="훈련비 관리" description="전체 차수별 훈련비 현황을 확인합니다." />

      {/* Desktop: 테이블 */}
      <div className="hidden lg:block bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">차수</th>
              <th className="text-left px-4 py-3 font-medium">입금 절차</th>
              <th className="text-left px-4 py-3 font-medium">환수</th>
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
                <td className="px-4 py-3 font-medium">{row.batchName}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                    row.status === "CMS_APPROVED"
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {PAYMENT_STATUS_LABELS[row.status] || row.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {row.refundStatus ? (
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.refundStatus === "REFUND_COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}>
                      {REFUND_STATUS_LABELS[row.refundStatus] || row.refundStatus}
                    </span>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </td>
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
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                row.status === "CMS_APPROVED"
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-100 text-blue-700"
              }`}>
                {PAYMENT_STATUS_LABELS[row.status] || row.status}
              </span>
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
            {row.refundStatus && (
              <div className="mt-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.refundStatus === "REFUND_COMPLETED"
                    ? "bg-green-100 text-green-700"
                    : "bg-orange-100 text-orange-700"
                }`}>
                  {REFUND_STATUS_LABELS[row.refundStatus] || row.refundStatus}
                </span>
              </div>
            )}
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
    </div>
  );
}
