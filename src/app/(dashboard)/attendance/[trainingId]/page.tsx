"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PageTitle from "@/components/ui/PageTitle";
import { ATTENDANCE_STATUS, ATTENDANCE_STATUS_LABELS } from "@/lib/constants";

interface User {
  id: string;
  name: string;
  rank: string;
  serviceNumber: string;
}

interface AttendanceRecord {
  userId: string;
  status: string;
  reason: string;
  earlyLeaveTime?: string | null;
  expectedConfirmAt?: string | null;
  user: User;
}

interface TrainingData {
  id: string;
  title: string;
  date: string;
  batch: { name: string; users: User[] };
}

export default function AttendancePage() {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [training, setTraining] = useState<TrainingData | null>(null);
  const [records, setRecords] = useState<Record<string, { status: string; reason: string; earlyLeaveTime?: string; expectedConfirmAt?: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/attendance/${trainingId}`)
      .then((r) => r.json())
      .then((data) => {
        setTraining(data.training);
        const rec: Record<string, { status: string; reason: string; earlyLeaveTime?: string; expectedConfirmAt?: string }> = {};
        // 차수 소속 모든 대상자 기본값 설정
        data.training?.batch?.users?.forEach((u: User) => {
          rec[u.id] = { status: "PENDING", reason: "" };
        });
        // 기존 출석 기록 덮어쓰기
        data.attendances?.forEach((a: AttendanceRecord) => {
          rec[a.userId] = {
            status: a.status,
            reason: a.reason || "",
            earlyLeaveTime: a.earlyLeaveTime || "",
            expectedConfirmAt: a.expectedConfirmAt || "",
          };
        });
        setRecords(rec);
      });
  }, [trainingId]);

  const handleSave = async () => {
    setSaving(true);
    const attendanceRecords = Object.entries(records).map(([userId, r]) => ({
      userId,
      status: r.status,
      reason: r.reason || undefined,
      earlyLeaveTime: r.earlyLeaveTime || undefined,
      expectedConfirmAt: r.expectedConfirmAt || undefined,
    }));

    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trainingId, records: attendanceRecords }),
    });

    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const setAllStatus = (status: string) => {
    const updated = { ...records };
    Object.keys(updated).forEach((uid) => {
      updated[uid] = { ...updated[uid], status };
    });
    setRecords(updated);
  };

  if (!training) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  }

  const users = training.batch?.users || [];
  const presentCount = Object.values(records).filter((r) => r.status === "PRESENT").length;
  const absentCount = Object.values(records).filter((r) => r.status === "ABSENT").length;

  return (
    <div className="max-w-3xl">
      <PageTitle
        title="출석 관리"
        description={`${training.title} - ${new Date(training.date).toLocaleDateString("ko-KR")}`}
      />

      {/* 통계 */}
      <div className="flex gap-4 mb-4">
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm">
          참석 <span className="font-bold text-green-700">{presentCount}</span>명
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm">
          불참 <span className="font-bold text-red-700">{absentCount}</span>명
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm">
          전체 <span className="font-bold">{users.length}</span>명
        </div>
      </div>

      {/* 일괄 설정 */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setAllStatus("PRESENT")} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
          전원 참석
        </button>
        <button onClick={() => setAllStatus("ABSENT")} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">
          전원 불참
        </button>
        <button onClick={() => setAllStatus("PENDING")} className="px-3 py-1.5 text-xs bg-gray-500 text-white rounded-lg hover:bg-gray-600">
          초기화
        </button>
      </div>

      {/* 출석 목록 */}
      <div className="bg-white rounded-xl border divide-y">
        {users.map((user) => {
          const rec = records[user.id] || { status: "PENDING", reason: "" };
          return (
            <div key={user.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{user.rank} {user.name}</p>
                  <p className="text-xs text-gray-400">{user.serviceNumber}</p>
                </div>
                <div className="flex gap-1">
                  {Object.entries(ATTENDANCE_STATUS).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() =>
                        setRecords({ ...records, [user.id]: { ...rec, status: value } })
                      }
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                        rec.status === value
                          ? value === "PRESENT" ? "bg-green-600 text-white" :
                            value === "ABSENT" ? "bg-red-600 text-white" :
                            "bg-gray-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {ATTENDANCE_STATUS_LABELS[value]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 상태별 추가 정보 표시 */}
              {rec.status === "PRESENT" && rec.earlyLeaveTime && (
                <div className="mt-2 px-2 py-1 bg-orange-50 border border-orange-200 rounded-lg">
                  <span className="text-xs text-orange-700">조기퇴소: {rec.earlyLeaveTime}</span>
                </div>
              )}

              {rec.status === "PENDING" && rec.expectedConfirmAt && (
                <div className="mt-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-xs text-blue-700">
                    확정 예정: {new Date(rec.expectedConfirmAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}{" "}
                    {new Date(rec.expectedConfirmAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}

              {rec.status === "ABSENT" && (
                <input
                  placeholder="불참 사유"
                  value={rec.reason}
                  onChange={(e) =>
                    setRecords({ ...records, [user.id]: { ...rec, reason: e.target.value } })
                  }
                  className="mt-2 w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* 저장 버튼 */}
      <div className="sticky bottom-20 lg:bottom-4 mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full py-3 rounded-xl font-medium text-white transition-colors ${
            saved ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
          } disabled:opacity-50`}
        >
          {saving ? "저장 중..." : saved ? "저장 완료!" : "출석 저장"}
        </button>
      </div>
    </div>
  );
}
