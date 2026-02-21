"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";

interface CommutingRecord {
  id: string;
  userId: string;
  date: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  isManual: boolean;
  note: string | null;
  user: { id: string; name: string; rank: string; serviceNumber: string };
}

export default function CommutingPage() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<CommutingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [todayRecord, setTodayRecord] = useState<CommutingRecord | null>(null);

  // 관리자 수기 입력 모달
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({ userId: "", date: "", checkInAt: "", checkOutAt: "", note: "" });
  const [users, setUsers] = useState<{ id: string; name: string; rank: string }[]>([]);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  useEffect(() => {
    fetchRecords();
    if (isAdmin) {
      fetch("/api/users?role=RESERVIST").then((r) => r.json()).then(setUsers).catch(() => {});
    }
  }, [isAdmin]);

  const fetchRecords = async () => {
    const res = await fetch("/api/commuting");
    const data = await res.json();
    setRecords(data);
    // 오늘 기록 찾기
    const today = new Date().toDateString();
    const todayRec = data.find((r: CommutingRecord) => new Date(r.date).toDateString() === today);
    setTodayRecord(todayRec || null);
  };

  const handleGpsAction = async (type: "checkIn" | "checkOut") => {
    setLoading(true);
    setGpsStatus("위치 확인 중...");

    if (!navigator.geolocation) {
      setGpsStatus("GPS를 지원하지 않는 브라우저입니다.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGpsStatus("서버로 전송 중...");
        const res = await fetch("/api/commuting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            type,
          }),
        });

        const data = await res.json();
        if (res.ok) {
          setGpsStatus(type === "checkIn" ? "출근 완료!" : "퇴근 완료!");
          fetchRecords();
        } else {
          setGpsStatus(data.error || "처리 실패");
        }
        setLoading(false);
      },
      (err) => {
        setGpsStatus("위치 정보를 가져올 수 없습니다. 위치 권한을 확인하세요.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleManualSubmit = async () => {
    const res = await fetch("/api/commuting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manualForm, isManual: true }),
    });
    if (res.ok) {
      setShowManual(false);
      setManualForm({ userId: "", date: "", checkInAt: "", checkOutAt: "", note: "" });
      fetchRecords();
    }
  };

  return (
    <div>
      <PageTitle
        title="출퇴근 기록"
        description="위병소 기준 출퇴근을 기록합니다."
        actions={
          isAdmin ? (
            <button
              onClick={() => setShowManual(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              수기 입력
            </button>
          ) : undefined
        }
      />

      {/* 대상자: GPS 출퇴근 버튼 */}
      {session?.user?.role === "RESERVIST" && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h3 className="font-semibold mb-4">오늘 출퇴근</h3>
          <div className="flex gap-4">
            <button
              onClick={() => handleGpsAction("checkIn")}
              disabled={loading || !!todayRecord?.checkInAt}
              className="flex-1 py-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {todayRecord?.checkInAt
                ? `출근 완료 (${new Date(todayRecord.checkInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})`
                : "출근"}
            </button>
            <button
              onClick={() => handleGpsAction("checkOut")}
              disabled={loading || !todayRecord?.checkInAt || !!todayRecord?.checkOutAt}
              className="flex-1 py-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {todayRecord?.checkOutAt
                ? `퇴근 완료 (${new Date(todayRecord.checkOutAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })})`
                : "퇴근"}
            </button>
          </div>
          {gpsStatus && (
            <p className="text-sm text-center mt-3 text-gray-500">{gpsStatus}</p>
          )}
        </div>
      )}

      {/* 기록 목록 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {isAdmin && <th className="text-left px-4 py-3 font-medium">대상자</th>}
              <th className="text-left px-4 py-3 font-medium">날짜</th>
              <th className="text-left px-4 py-3 font-medium">출근</th>
              <th className="text-left px-4 py-3 font-medium">퇴근</th>
              {isAdmin && <th className="text-left px-4 py-3 font-medium">GPS</th>}
              <th className="text-left px-4 py-3 font-medium">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                {isAdmin && <td className="px-4 py-3">{r.user.rank} {r.user.name}</td>}
                <td className="px-4 py-3">{new Date(r.date).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3">
                  {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </td>
                <td className="px-4 py-3">
                  {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {r.isManual ? (
                      <span className="text-yellow-600">수기</span>
                    ) : r.checkInLat ? (
                      <span title={`${r.checkInLat}, ${r.checkInLng}`}>
                        {r.checkInLat?.toFixed(4)}, {r.checkInLng?.toFixed(4)}
                      </span>
                    ) : "-"}
                  </td>
                )}
                <td className="px-4 py-3 text-gray-500">{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p className="text-center py-8 text-gray-400">출퇴근 기록이 없습니다.</p>
        )}
      </div>

      {/* 수기 입력 모달 */}
      {showManual && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">수기 출퇴근 입력</h3>
            <div>
              <label className="block text-sm font-medium mb-1">대상자</label>
              <select
                value={manualForm.userId}
                onChange={(e) => setManualForm({ ...manualForm, userId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">선택</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.rank} {u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">날짜</label>
              <input type="date" value={manualForm.date} onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">출근 시간</label>
                <input type="datetime-local" value={manualForm.checkInAt} onChange={(e) => setManualForm({ ...manualForm, checkInAt: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">퇴근 시간</label>
                <input type="datetime-local" value={manualForm.checkOutAt} onChange={(e) => setManualForm({ ...manualForm, checkOutAt: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">비고</label>
              <input value={manualForm.note} onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleManualSubmit} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">저장</button>
              <button onClick={() => setShowManual(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
