"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

interface Batch {
  id: string;
  name: string;
}

interface BatchUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
}

interface Training {
  id: string;
  title: string;
  type: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
}

interface AttendanceSummary {
  byUser: { userId: string; name: string; rank: string | null; present: number; absent: number; pending: number; total: number; rate: number }[];
  byTraining: { trainingId: string; title: string; date: string; present: number; absent: number; pending: number; total: number; rate: number }[];
}

interface AttendanceRecord {
  userId: string;
  status: string;
}

interface RowData {
  userId: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  checkIn: string;
  checkOut: string;
  note: string;
  attendanceStatus: string;
}

export default function CommutingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [records, setRecords] = useState<CommutingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>("");
  const [todayRecord, setTodayRecord] = useState<CommutingRecord | null>(null);
  const [showGpsHelp, setShowGpsHelp] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  // Admin state
  const [adminTab, setAdminTab] = useState<"attendance" | "commuting">("attendance");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().split("T")[0];
  });
  const [batchUsers, setBatchUsers] = useState<BatchUser[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [saving, setSaving] = useState(false);

  // Attendance tab state
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  // Reservist: fetch records
  const fetchRecords = useCallback(async () => {
    const res = await fetch("/api/commuting");
    const data = await res.json();
    setRecords(data);
    const today = new Date().toDateString();
    const todayRec = data.find((r: CommutingRecord) => new Date(r.date).toDateString() === today);
    setTodayRecord(todayRec || null);
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      fetchRecords();
    }
  }, [isAdmin, fetchRecords]);

  // Admin: fetch batches
  useEffect(() => {
    if (isAdmin) {
      fetch("/api/batches").then((r) => r.json()).then((data) => {
        setBatches(data);
        if (data.length > 0) setSelectedBatchId(data[0].id);
      });
    }
  }, [isAdmin]);

  // Admin: fetch attendance tab data
  useEffect(() => {
    if (!isAdmin || !selectedBatchId || adminTab !== "attendance") return;
    setAttendanceLoading(true);

    fetch(`/api/batches/${selectedBatchId}/attendance-summary`)
      .then((r) => r.json())
      .then(setAttendanceSummary)
      .catch(() => setAttendanceSummary(null))
      .finally(() => setAttendanceLoading(false));
  }, [isAdmin, selectedBatchId, adminTab]);

  // Admin: fetch commuting tab data
  useEffect(() => {
    if (!isAdmin || !selectedBatchId || !selectedDate || adminTab !== "commuting") return;

    const fetchData = async () => {
      setLoading(true);
      const batchRes = await fetch(`/api/batches/${selectedBatchId}`);
      const batchData = await batchRes.json();
      const users: BatchUser[] = batchData.users || [];
      setBatchUsers(users);

      const recRes = await fetch(`/api/commuting?batchId=${selectedBatchId}&date=${selectedDate}`);
      const existingRecords: CommutingRecord[] = await recRes.json();

      // Fetch attendance for trainings on this date
      const dateTrainings = (batchData.trainings || []).filter((t: Training) => {
        const tDate = t.date.split("T")[0];
        return tDate === selectedDate;
      });

      let attendanceMap: Record<string, string> = {};
      if (dateTrainings.length > 0) {
        try {
          const attRes = await fetch(`/api/attendance/${dateTrainings[0].id}`);
          const attData: AttendanceRecord[] = await attRes.json();
          if (Array.isArray(attData)) {
            for (const a of attData) {
              attendanceMap[a.userId] = a.status;
            }
          }
        } catch { /* ignore */ }
      }

      const newRows: RowData[] = users.map((u) => {
        const existing = existingRecords.find((r) => r.userId === u.id);
        return {
          userId: u.id,
          name: u.name,
          rank: u.rank,
          serviceNumber: u.serviceNumber,
          checkIn: existing?.checkInAt
            ? new Date(existing.checkInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
            : "",
          checkOut: existing?.checkOutAt
            ? new Date(existing.checkOutAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
            : "",
          note: existing?.note || "",
          attendanceStatus: attendanceMap[u.id] || "",
        };
      });
      setRows(newRows);
      setLoading(false);
    };

    fetchData();
  }, [isAdmin, selectedBatchId, selectedDate, adminTab]);

  const updateRow = (idx: number, field: keyof RowData, value: string) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleBulkSave = async () => {
    setSaving(true);
    const promises = rows
      .filter((row) => row.attendanceStatus !== "ABSENT")
      .map((row) => {
        const checkInAt = row.checkIn ? `${selectedDate}T${row.checkIn}:00` : "";
        const checkOutAt = row.checkOut ? `${selectedDate}T${row.checkOut}:00` : "";

        return fetch("/api/commuting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isManual: true,
            userId: row.userId,
            date: selectedDate,
            checkInAt: checkInAt || undefined,
            checkOutAt: checkOutAt || undefined,
            note: row.note || undefined,
            batchId: selectedBatchId || undefined,
          }),
        });
      });

    await Promise.all(promises);
    setSaving(false);
    alert("저장 완료되었습니다.");
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
      (error: GeolocationPositionError) => {
        const messages: Record<number, string> = {
          1: "위치 권한이 거부되었습니다.",
          2: "위치를 확인할 수 없습니다 (실내에서는 GPS가 약할 수 있습니다).",
          3: "위치 요청 시간이 초과되었습니다.",
        };
        setGpsStatus(messages[error.code] || "위치 정보를 가져올 수 없습니다.");
        setShowGpsHelp(true);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const STATUS_COLOR: Record<string, string> = {
    PRESENT: "text-green-600",
    ABSENT: "text-red-600",
    PENDING: "text-yellow-600",
  };
  const STATUS_LABEL: Record<string, string> = {
    PRESENT: "참석",
    ABSENT: "불참",
    PENDING: "미정",
  };

  // ─── Admin View ───
  if (isAdmin) {
    return (
      <div>
        <PageTitle title="참석 관리" description="출석 현황과 출퇴근을 통합 관리합니다." />

        {/* 차수 선택 */}
        <div className="mb-4">
          <select
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setAdminTab("attendance")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${adminTab === "attendance" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-800"}`}
          >
            출석 현황
          </button>
          <button
            onClick={() => setAdminTab("commuting")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${adminTab === "commuting" ? "bg-white shadow text-blue-600" : "text-gray-600 hover:text-gray-800"}`}
          >
            출퇴근 입력
          </button>
        </div>

        {loading && adminTab === "commuting" && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        )}

        {/* 탭 1: 출석 현황 */}
        {adminTab === "attendance" && (
          <div className="space-y-6">
            {attendanceLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : attendanceSummary ? (
              <>
                {/* 인원별 출석률 */}
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h3 className="font-semibold text-sm">인원별 출석률</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs border-b">
                          <th className="px-4 py-2 font-medium">이름</th>
                          <th className="px-4 py-2 font-medium text-center">참석</th>
                          <th className="px-4 py-2 font-medium text-center">불참</th>
                          <th className="px-4 py-2 font-medium text-center">미정</th>
                          <th className="px-4 py-2 font-medium text-center">출석률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendanceSummary.byUser.map((u) => (
                          <tr key={u.userId} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5">
                              <span className="font-medium">{u.name}</span>
                              {u.rank && <span className="ml-1 text-xs text-gray-500">{u.rank}</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center text-green-600 font-medium">{u.present}</td>
                            <td className="px-4 py-2.5 text-center text-red-600 font-medium">{u.absent}</td>
                            <td className="px-4 py-2.5 text-center text-gray-500">{u.pending}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                u.rate >= 80 ? "bg-green-100 text-green-700" :
                                u.rate >= 50 ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {u.rate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {attendanceSummary.byUser.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">출석 데이터가 없습니다.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 훈련별 참석률 */}
                <div className="bg-white rounded-xl border overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b">
                    <h3 className="font-semibold text-sm">훈련별 참석률</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 text-xs border-b">
                          <th className="px-4 py-2 font-medium">훈련명</th>
                          <th className="px-4 py-2 font-medium">날짜</th>
                          <th className="px-4 py-2 font-medium text-center">참석</th>
                          <th className="px-4 py-2 font-medium text-center">전체</th>
                          <th className="px-4 py-2 font-medium text-center">참석률</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendanceSummary.byTraining.map((t) => (
                          <tr key={t.trainingId} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium">{t.title}</td>
                            <td className="px-4 py-2.5 text-gray-500">{new Date(t.date).toLocaleDateString("ko-KR")}</td>
                            <td className="px-4 py-2.5 text-center text-green-600 font-medium">{t.present}</td>
                            <td className="px-4 py-2.5 text-center">{t.total}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                t.rate >= 80 ? "bg-green-100 text-green-700" :
                                t.rate >= 50 ? "bg-yellow-100 text-yellow-700" :
                                "bg-red-100 text-red-700"
                              }`}>
                                {t.rate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        {attendanceSummary.byTraining.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">훈련 데이터가 없습니다.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-gray-400">출석 데이터를 불러올 수 없습니다.</div>
            )}
          </div>
        )}

        {/* 탭 2: 출퇴근 입력 */}
        {!loading && adminTab === "commuting" && (
          <>
            <div className="mb-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm"
              />
            </div>

            {/* Desktop: 테이블 */}
            <div className="hidden lg:block bg-white rounded-xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">대상자</th>
                    <th className="text-left px-4 py-3 font-medium w-20">참석</th>
                    <th className="text-left px-4 py-3 font-medium w-36">출근시간</th>
                    <th className="text-left px-4 py-3 font-medium w-36">퇴근시간</th>
                    <th className="text-left px-4 py-3 font-medium">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400">배정된 대상자가 없습니다.</td>
                    </tr>
                  )}
                  {rows.map((row, idx) => {
                    const isAbsent = row.attendanceStatus === "ABSENT";
                    const isPending = row.attendanceStatus === "PENDING";
                    return (
                      <tr
                        key={row.userId}
                        className={`${isAbsent ? "bg-red-50 opacity-60" : isPending ? "bg-yellow-50" : "hover:bg-gray-50"}`}
                      >
                        <td className="px-4 py-2">
                          <span className="text-gray-500">{row.rank}</span> {row.name}
                          <span className="text-xs text-gray-400 ml-2">{row.serviceNumber}</span>
                        </td>
                        <td className="px-4 py-2">
                          {row.attendanceStatus ? (
                            <span className={`text-xs font-medium ${STATUS_COLOR[row.attendanceStatus] || ""}`}>
                              {STATUS_LABEL[row.attendanceStatus] || row.attendanceStatus}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="time"
                            value={row.checkIn}
                            onChange={(e) => updateRow(idx, "checkIn", e.target.value)}
                            disabled={isAbsent}
                            className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="time"
                            value={row.checkOut}
                            onChange={(e) => updateRow(idx, "checkOut", e.target.value)}
                            disabled={isAbsent}
                            className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            value={row.note}
                            onChange={(e) => updateRow(idx, "note", e.target.value)}
                            placeholder="비고"
                            disabled={isAbsent}
                            className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: 카드 리스트 */}
            <div className="lg:hidden space-y-3">
              {rows.length === 0 && (
                <p className="text-center py-8 text-gray-400">배정된 대상자가 없습니다.</p>
              )}
              {rows.map((row, idx) => {
                const isAbsent = row.attendanceStatus === "ABSENT";
                return (
                  <div
                    key={row.userId}
                    className={`bg-white rounded-xl border p-4 ${isAbsent ? "bg-red-50 opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-sm">
                        <span className="text-gray-500">{row.rank}</span> {row.name}
                      </div>
                      {row.attendanceStatus ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.attendanceStatus === "PRESENT" ? "bg-green-100 text-green-700" :
                          row.attendanceStatus === "ABSENT" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {STATUS_LABEL[row.attendanceStatus] || row.attendanceStatus}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">출근시간</label>
                        <input
                          type="time"
                          value={row.checkIn}
                          onChange={(e) => updateRow(idx, "checkIn", e.target.value)}
                          disabled={isAbsent}
                          className="w-full px-2 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">퇴근시간</label>
                        <input
                          type="time"
                          value={row.checkOut}
                          onChange={(e) => updateRow(idx, "checkOut", e.target.value)}
                          disabled={isAbsent}
                          className="w-full px-2 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    <input
                      value={row.note}
                      onChange={(e) => updateRow(idx, "note", e.target.value)}
                      placeholder="비고"
                      disabled={isAbsent}
                      className="w-full px-2 py-1.5 border rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>
                );
              })}
            </div>

            {rows.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleBulkSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "일괄 저장"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ─── Reservist View ───
  return (
    <div>
      <PageTitle
        title="출퇴근 기록"
        description="위병소 기준 출퇴근을 기록합니다."
      />

      {/* GPS 출퇴근 버튼 */}
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
        {showGpsHelp && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-yellow-800 mb-2">위치 권한 설정 안내</h4>
            <div className="text-xs text-yellow-700 space-y-2">
              <div>
                <p className="font-medium">iPhone Safari:</p>
                <p>설정 &gt; Safari &gt; 위치 &gt; &quot;허용&quot;으로 변경</p>
              </div>
              <div>
                <p className="font-medium">Android Chrome:</p>
                <p>설정 &gt; 사이트 설정 &gt; 위치 &gt; 허용</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowGpsHelp(false);
                setGpsStatus("");
              }}
              className="mt-3 w-full py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* 기록 목록 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">날짜</th>
              <th className="text-left px-4 py-3 font-medium">출근</th>
              <th className="text-left px-4 py-3 font-medium">퇴근</th>
              <th className="text-left px-4 py-3 font-medium">비고</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{new Date(r.date).toLocaleDateString("ko-KR")}</td>
                <td className="px-4 py-3">
                  {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </td>
                <td className="px-4 py-3">
                  {r.checkOutAt ? new Date(r.checkOutAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                </td>
                <td className="px-4 py-3 text-gray-500">{r.note || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && (
          <p className="text-center py-8 text-gray-400">출퇴근 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
