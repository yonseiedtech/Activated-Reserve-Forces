"use client";

import { useEffect, useState } from "react";
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

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

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
        // 저장 후 결과 갱신 (savedAmount 반영)
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

  const okCount = results.filter((r) => r.status === "OK").length;
  const totalCalc = results
    .filter((r) => r.status === "OK")
    .reduce((sum, r) => sum + (r.calculatedAmount || 0), 0);

  if (!isAdmin) return null;

  return (
    <div>
      <PageTitle title="교통비 관리" description="차수별 인원 교통비를 일괄 계산하고 저장합니다." />

      {/* 차수 선택 + 계산 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <select
          value={selectedBatchId}
          onChange={(e) => {
            setSelectedBatchId(e.target.value);
            setResults([]);
            setSaveMsg("");
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
        <button
          onClick={handleCalculate}
          disabled={!selectedBatchId || calculating}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {calculating ? "계산 중..." : "일괄 계산"}
        </button>
      </div>

      {/* 기준 부대 표시 */}
      {unitName && (
        <p className="text-xs text-gray-500 mb-4">
          기준 부대: <span className="font-medium">{unitName}</span>
        </p>
      )}

      {/* 결과 테이블 */}
      {results.length > 0 && (
        <>
          {/* 요약 */}
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

          {/* 저장 버튼 */}
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
    </div>
  );
}
