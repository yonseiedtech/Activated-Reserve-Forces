"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";

interface PendingUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  unit: string | null;
  zipCode: string | null;
  address: string | null;
  addressDetail: string | null;
  pendingZipCode: string | null;
  pendingAddress: string | null;
  pendingAddressDetail: string | null;
}

export default function AdminAddressPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = async () => {
    try {
      const res = await fetch("/api/profile/address/manage");
      if (res.ok) {
        setUsers(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAction = async (userId: string, action: "approve" | "reject", reason?: string) => {
    setProcessing(userId);
    try {
      const res = await fetch("/api/profile/address/manage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action, rejectReason: reason }),
      });
      if (res.ok) {
        showMessage("success", action === "approve" ? "주소 변경이 승인되었습니다." : "주소 변경이 반려되었습니다.");
        setRejectTarget(null);
        setRejectReason("");
        await fetchPending();
      } else {
        const err = await res.json();
        showMessage("error", err.error || "처리에 실패했습니다.");
      }
    } catch {
      showMessage("error", "처리 중 오류가 발생했습니다.");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div>
      <PageTitle title="주소 변경 승인" description="대상자의 주소 변경 요청을 승인 또는 반려합니다." />

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          데이터를 불러오는 중...
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          승인 대기 중인 주소 변경 요청이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {users.map((u) => (
            <div key={u.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="font-semibold text-sm">
                    {u.rank ? `${u.rank} ` : ""}{u.name}
                  </span>
                  {u.serviceNumber && (
                    <span className="text-xs text-gray-500 ml-2">{u.serviceNumber}</span>
                  )}
                  {u.unit && (
                    <span className="text-xs text-gray-400 ml-2">{u.unit}</span>
                  )}
                </div>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                  대기
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 font-medium mb-1">현재 주소</p>
                  {u.address ? (
                    <>
                      <p className="text-gray-700">[{u.zipCode}] {u.address}</p>
                      {u.addressDetail && <p className="text-gray-600 text-xs">{u.addressDetail}</p>}
                    </>
                  ) : (
                    <p className="text-gray-400">등록된 주소 없음</p>
                  )}
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-600 font-medium mb-1">변경 요청 주소</p>
                  <p className="text-gray-700">[{u.pendingZipCode}] {u.pendingAddress}</p>
                  {u.pendingAddressDetail && <p className="text-gray-600 text-xs">{u.pendingAddressDetail}</p>}
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAction(u.id, "approve")}
                  disabled={!!processing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  {processing === u.id ? "처리 중..." : "승인"}
                </button>
                <button
                  onClick={() => setRejectTarget(u.id)}
                  disabled={!!processing}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
                >
                  반려
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 반려 사유 입력 모달 */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">반려 사유</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요..."
              className="w-full px-3 py-2 border rounded-lg text-sm h-24 resize-none outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleAction(rejectTarget, "reject", rejectReason)}
                disabled={!!processing}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "처리 중..." : "반려"}
              </button>
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(""); }}
                className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
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
