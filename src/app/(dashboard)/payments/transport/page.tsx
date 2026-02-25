"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import PageTitle from "@/components/ui/PageTitle";

interface Batch {
  id: string;
  name: string;
}

interface TransportResult {
  userId: string;
  name: string;
  rank: string | null;
  address: string | null;
  distanceKm: number | null;
  calculatedAmount: number | null;
  savedAmount: number | null;
  status: "OK" | "NO_ADDRESS" | "GEO_FAIL" | "ROUTE_FAIL" | "ERROR";
}

interface BatchUser {
  id: string;
  name: string;
  rank: string | null;
  unit: string | null;
  birthDate: string | null;
  bankName: string | null;
  bankAccount: string | null;
}

interface BatchDetail {
  name: string;
  users: BatchUser[];
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OK: { label: "정상", color: "bg-green-100 text-green-700" },
  NO_ADDRESS: { label: "주소 미등록", color: "bg-yellow-100 text-yellow-700" },
  GEO_FAIL: { label: "좌표 변환 실패", color: "bg-red-100 text-red-700" },
  ROUTE_FAIL: { label: "경로 조회 실패", color: "bg-red-100 text-red-700" },
  ERROR: { label: "오류", color: "bg-red-100 text-red-700" },
};

export default function TransportManagePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [unitName, setUnitName] = useState("");
  const [results, setResults] = useState<TransportResult[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"transport" | "bankAccount">("transport");

  // 계좌현황
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  const fetchBatchDetail = useCallback(async (batchId: string) => {
    if (!batchId) {
      setBatchDetail(null);
      return;
    }
    setLoadingBatch(true);
    try {
      const res = await fetch(`/api/batches/${batchId}`);
      if (res.ok) {
        const data = await res.json();
        setBatchDetail({ name: data.name, users: data.users || [] });
      }
    } catch {
      // ignore
    } finally {
      setLoadingBatch(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    if (!isAdmin) {
      router.replace("/payments");
      return;
    }
    fetch("/api/batches")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBatches(data);
      })
      .catch(() => {});
  }, [session, isAdmin, router]);

  // 차수 선택 시 계좌현황 탭이면 자동 조회
  useEffect(() => {
    if (activeTab === "bankAccount" && selectedBatchId) {
      fetchBatchDetail(selectedBatchId);
    }
  }, [activeTab, selectedBatchId, fetchBatchDetail]);

  const handleCalculate = async () => {
    if (!selectedBatchId) return;
    setCalculating(true);
    setResults([]);
    setSaveMsg("");
    try {
      const res = await fetch("/api/transport-calc/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedBatchId }),
      });
      const data = await res.json();
      if (res.ok) {
        setUnitName(data.unitName || "");
        setResults(data.results || []);
      } else {
        alert(data.error || "계산 실패");
      }
    } catch {
      alert("교통비 계산 중 오류가 발생했습니다.");
    } finally {
      setCalculating(false);
    }
  };

  const handleSave = async () => {
    const records = results
      .filter((r) => r.status === "OK" && r.calculatedAmount != null)
      .map((r) => ({
        userId: r.userId,
        amount: r.calculatedAmount!,
        address: r.address || undefined,
      }));

    if (records.length === 0) {
      alert("저장할 교통비 데이터가 없습니다.");
      return;
    }

    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/payments/transport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: selectedBatchId, records }),
      });
      if (res.ok) {
        setSaveMsg(`${records.length}명의 교통비가 저장되었습니다.`);
        setResults((prev) =>
          prev.map((r) => {
            const saved = records.find((rec) => rec.userId === r.userId);
            return saved ? { ...r, savedAmount: saved.amount } : r;
          })
        );
      } else {
        alert("저장 실패");
      }
    } catch {
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrintBankAccounts = () => {
    if (!batchDetail) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rows = batchDetail.users.map((u, i) => {
      const bd = u.birthDate ? new Date(u.birthDate).toLocaleDateString("ko-KR") : "";
      return `<tr><td style="padding:6px 10px;border:1px solid #333;text-align:center;font-size:13px;">${i + 1}</td><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${u.unit || ""}</td><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${u.name}</td><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${u.bankName || ""}</td><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${u.bankAccount || ""}</td><td style="padding:6px 10px;border:1px solid #333;font-size:13px;">${bd}</td></tr>`;
    }).join("");

    printWindow.document.write(`<!DOCTYPE html><html><head><title>보상금 지급 계좌 파악</title>
      <style>
        @page { size: A4 landscape; margin: 15mm; }
        body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; font-size: 14px; }
        h1 { text-align: center; font-size: 22px; margin-bottom: 20px; letter-spacing: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { padding: 8px 10px; border: 1px solid #333; background: #f5f5f5; font-weight: bold; font-size: 13px; text-align: center; }
        .notice { margin-top: 24px; font-size: 12px; line-height: 1.8; }
        .notice li { margin-bottom: 4px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>보상금 지급 계좌 파악</h1>
      <p style="text-align:right;font-size:13px;margin-bottom:10px;">${batchDetail.name}</p>
      <table>
        <thead><tr><th>번호</th><th>소속예비군중대</th><th>성명</th><th>은행명</th><th>계좌번호</th><th>생년월일</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="notice">
        <p><strong>※ 안내사항</strong></p>
        <ol>
          <li>1. 보상금은 본인 명의 계좌로만 지급 가능합니다.</li>
          <li>2. 계좌번호 오류 시 입금이 불가하오니 정확히 기재하여 주시기 바랍니다.</li>
          <li>3. 타인 명의 계좌 기재 시 보상금 지급이 불가합니다.</li>
          <li>4. 보상금 관련 문의: 행정보급관</li>
        </ol>
      </div>
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  const okCount = results.filter((r) => r.status === "OK").length;
  const totalCalc = results
    .filter((r) => r.status === "OK")
    .reduce((sum, r) => sum + (r.calculatedAmount || 0), 0);

  if (!isAdmin) return null;

  return (
    <div>
      <PageTitle title="교통비 관리" description="차수별 교통비 계산 및 보상금 계좌를 관리합니다." />

      {/* 차수 선택 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={selectedBatchId}
          onChange={(e) => {
            setSelectedBatchId(e.target.value);
            setResults([]);
            setSaveMsg("");
            setBatchDetail(null);
          }}
          className="flex-1 px-4 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">차수 선택</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        <button
          onClick={() => setActiveTab("transport")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "transport" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          교통비 계산
        </button>
        <button
          onClick={() => setActiveTab("bankAccount")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "bankAccount" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-900"}`}
        >
          계좌현황
        </button>
      </div>

      {/* 교통비 계산 탭 */}
      {activeTab === "transport" && (
        <>
          <div className="mb-6">
            <button
              onClick={handleCalculate}
              disabled={!selectedBatchId || calculating}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {calculating ? "계산 중..." : "일괄 계산"}
            </button>
          </div>

          {unitName && (
            <p className="text-xs text-gray-500 mb-4">
              기준 부대: <span className="font-medium">{unitName}</span>
            </p>
          )}

          {results.length > 0 && (
            <>
              <div className="flex items-center gap-4 mb-4 text-sm">
                <span className="text-gray-500">
                  계산 완료: <span className="font-medium text-gray-900">{okCount}</span>/{results.length}명
                </span>
                <span className="text-gray-500">
                  합계: <span className="font-medium text-gray-900">{totalCalc.toLocaleString()}원</span>
                </span>
              </div>

              {/* Desktop 테이블 */}
              <div className="hidden lg:block bg-white rounded-xl border overflow-x-auto mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">계급/이름</th>
                      <th className="text-left px-4 py-3 font-medium">주소</th>
                      <th className="text-right px-4 py-3 font-medium">거리(km)</th>
                      <th className="text-right px-4 py-3 font-medium">교통비(원)</th>
                      <th className="text-right px-4 py-3 font-medium">저장됨</th>
                      <th className="text-center px-4 py-3 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {results.map((r) => {
                      const st = STATUS_LABELS[r.status];
                      return (
                        <tr key={r.userId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">
                            {r.rank} {r.name}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                            {r.address || "-"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {r.distanceKm != null ? `${r.distanceKm}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            {r.calculatedAmount != null ? `${r.calculatedAmount.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {r.savedAmount != null ? `${r.savedAmount.toLocaleString()}` : "-"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile 카드 */}
              <div className="lg:hidden space-y-3 mb-4">
                {results.map((r) => {
                  const st = STATUS_LABELS[r.status];
                  return (
                    <div key={r.userId} className="bg-white rounded-xl border p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {r.rank} {r.name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 truncate">{r.address || "주소 미등록"}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-gray-400">거리</p>
                          <p className="font-medium text-gray-700">
                            {r.distanceKm != null ? `${r.distanceKm}km` : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">교통비</p>
                          <p className="font-medium text-gray-700">
                            {r.calculatedAmount != null ? `${r.calculatedAmount.toLocaleString()}원` : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">저장됨</p>
                          <p className="font-medium text-gray-500">
                            {r.savedAmount != null ? `${r.savedAmount.toLocaleString()}원` : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving || okCount === 0}
                  className="px-6 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "저장 중..." : `교통비 저장 (${okCount}명)`}
                </button>
                {saveMsg && <span className="text-sm text-green-600 font-medium">{saveMsg}</span>}
              </div>
            </>
          )}

          {!selectedBatchId && (
            <p className="text-center py-8 text-gray-400 text-sm">차수를 선택하세요.</p>
          )}
        </>
      )}

      {/* 계좌현황 탭 */}
      {activeTab === "bankAccount" && (
        <>
          {!selectedBatchId && (
            <p className="text-center py-8 text-gray-400 text-sm">차수를 선택하세요.</p>
          )}

          {selectedBatchId && loadingBatch && (
            <p className="text-center py-8 text-gray-400 text-sm">불러오는 중...</p>
          )}

          {selectedBatchId && batchDetail && !loadingBatch && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">보상금 지급 계좌 현황</h3>
                <button
                  onClick={handlePrintBankAccounts}
                  className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  인쇄
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-xs">번호</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">소속</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">성명</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">은행명</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">계좌번호</th>
                      <th className="text-left px-4 py-2 font-medium text-xs">생년월일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {batchDetail.users.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-gray-400">배정된 대상자가 없습니다.</td></tr>
                    ) : (
                      batchDetail.users.map((u, i) => (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-4 py-2">{u.unit || "-"}</td>
                          <td className="px-4 py-2 font-medium">{u.name}</td>
                          <td className="px-4 py-2">{u.bankName || <span className="text-gray-300">미등록</span>}</td>
                          <td className="px-4 py-2">{u.bankAccount || <span className="text-gray-300">미등록</span>}</td>
                          <td className="px-4 py-2 text-gray-500">{u.birthDate ? new Date(u.birthDate).toLocaleDateString("ko-KR") : "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t text-xs text-gray-500">
                계좌 등록: {batchDetail.users.filter((u) => u.bankAccount).length}명 / 전체 {batchDetail.users.length}명
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
