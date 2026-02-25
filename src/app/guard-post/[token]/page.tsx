"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface GuardPostUser {
  userId: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
}

interface GuardPostData {
  batchName: string;
  batchId: string;
  startDate: string;
  endDate: string;
  label: string | null;
  users: GuardPostUser[];
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

export default function GuardPostPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<GuardPostData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [errorType, setErrorType] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/guard-post/${token}`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json();
          setError(err.error || "링크를 불러올 수 없습니다.");
          setErrorType(err.notTrainingDay ? "notTrainingDay" : null);
          setData(null);
        } else {
          const d = await r.json();
          setData(d);
          setError("");
          setErrorType(null);
        }
      })
      .catch(() => setError("네트워크 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    fetchData();
    // 30초마다 자동 새로고침
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const handleAction = async (userId: string, type: "checkIn" | "checkOut" | "cancelCheckIn" | "cancelCheckOut") => {
    setActionLoading(`${userId}-${type}`);
    try {
      const res = await fetch(`/api/guard-post/${token}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, type }),
      });
      if (res.ok) {
        const result = await res.json();
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) =>
              u.userId === userId
                ? { ...u, checkInAt: result.checkInAt, checkOutAt: result.checkOutAt }
                : u
            ),
          };
        });
        setConfirmCancel(null);
      } else {
        const err = await res.json();
        alert(err.error || "처리 중 오류가 발생했습니다.");
      }
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">{errorType === "notTrainingDay" ? "📅" : "🔒"}</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">
          {errorType === "notTrainingDay" ? "훈련 일이 아닙니다" : "접근 불가"}
        </h2>
        <p className="text-gray-500">
          {errorType === "notTrainingDay"
            ? "설정된 훈련 기간이 아니므로 출퇴근 기록을 할 수 없습니다."
            : error}
        </p>
      </div>
    );
  }

  if (!data) return null;

  const now = new Date();
  const todayStr = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  const checkedInCount = data.users.filter((u) => u.checkInAt).length;
  const checkedOutCount = data.users.filter((u) => u.checkOutAt).length;

  return (
    <div className="space-y-4">
      {/* 헤더 정보 */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-900">{data.batchName}</h2>
          {data.label && (
            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{data.label}</span>
          )}
        </div>
        <p className="text-sm text-gray-600">{todayStr}</p>
        <div className="flex gap-4 mt-3 text-sm">
          <div className="bg-green-50 px-3 py-1.5 rounded-lg">
            <span className="text-green-600 font-medium">출근 {checkedInCount}</span>
            <span className="text-gray-400">/{data.users.length}</span>
          </div>
          <div className="bg-orange-50 px-3 py-1.5 rounded-lg">
            <span className="text-orange-600 font-medium">퇴근 {checkedOutCount}</span>
            <span className="text-gray-400">/{data.users.length}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">30초마다 자동 새로고침</p>
      </div>

      {/* 대상자 목록 */}
      <div className="space-y-3">
        {data.users.map((user) => (
          <div key={user.userId} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-sm text-gray-900">
                  {user.rank && <span className="text-gray-500">{user.rank} </span>}
                  {user.name}
                </p>
                {user.serviceNumber && (
                  <p className="text-xs text-gray-400">{user.serviceNumber}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 출근 */}
              <div>
                <p className="text-xs text-gray-500 mb-1">출근</p>
                {user.checkInAt ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-green-700">{formatTime(user.checkInAt)}</span>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-600 rounded text-xs">완료</span>
                    </div>
                    {confirmCancel === `${user.userId}-checkIn` ? (
                      <div className="flex gap-1 mt-1.5">
                        <button
                          onClick={() => handleAction(user.userId, "cancelCheckIn")}
                          disabled={actionLoading === `${user.userId}-cancelCheckIn`}
                          className="flex-1 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                        >
                          {actionLoading === `${user.userId}-cancelCheckIn` ? "처리중..." : "취소 확인"}
                        </button>
                        <button
                          onClick={() => setConfirmCancel(null)}
                          className="flex-1 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-300"
                        >
                          아니오
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancel(`${user.userId}-checkIn`)}
                        className="mt-1.5 text-xs text-gray-400 hover:text-red-500 underline"
                      >
                        출근 취소
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleAction(user.userId, "checkIn")}
                    disabled={actionLoading === `${user.userId}-checkIn`}
                    className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === `${user.userId}-checkIn` ? "처리중..." : "출근"}
                  </button>
                )}
              </div>

              {/* 퇴근 */}
              <div>
                <p className="text-xs text-gray-500 mb-1">퇴근</p>
                {user.checkOutAt ? (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-orange-700">{formatTime(user.checkOutAt)}</span>
                      <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">완료</span>
                    </div>
                    {confirmCancel === `${user.userId}-checkOut` ? (
                      <div className="flex gap-1 mt-1.5">
                        <button
                          onClick={() => handleAction(user.userId, "cancelCheckOut")}
                          disabled={actionLoading === `${user.userId}-cancelCheckOut`}
                          className="flex-1 py-1 bg-red-500 text-white rounded text-xs font-medium hover:bg-red-600 disabled:opacity-50"
                        >
                          {actionLoading === `${user.userId}-cancelCheckOut` ? "처리중..." : "취소 확인"}
                        </button>
                        <button
                          onClick={() => setConfirmCancel(null)}
                          className="flex-1 py-1 bg-gray-200 text-gray-600 rounded text-xs font-medium hover:bg-gray-300"
                        >
                          아니오
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmCancel(`${user.userId}-checkOut`)}
                        className="mt-1.5 text-xs text-gray-400 hover:text-red-500 underline"
                      >
                        퇴근 취소
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => handleAction(user.userId, "checkOut")}
                    disabled={actionLoading === `${user.userId}-checkOut`}
                    className="w-full py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                  >
                    {actionLoading === `${user.userId}-checkOut` ? "처리중..." : "퇴근"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
