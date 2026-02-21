"use client";

import { useState } from "react";

interface SelfAttendanceFormProps {
  trainingId: string;
  initialStatus?: string;
  initialReason?: string;
  initialExpectedConfirmAt?: string;
  initialEarlyLeaveTime?: string;
}

const EARLY_LEAVE_TIMES = [
  "08:30", "09:30", "10:30", "11:30", "12:30",
  "13:30", "14:30", "15:30", "16:30", "17:30",
];

export default function SelfAttendanceForm({
  trainingId,
  initialStatus = "PENDING",
  initialReason = "",
  initialExpectedConfirmAt = "",
  initialEarlyLeaveTime = "",
}: SelfAttendanceFormProps) {
  const [status, setStatus] = useState(initialStatus);
  const [subOption, setSubOption] = useState<"normal" | "early">(
    initialEarlyLeaveTime ? "early" : "normal"
  );
  const [earlyLeaveTime, setEarlyLeaveTime] = useState(initialEarlyLeaveTime);
  const [reason, setReason] = useState(initialReason);
  const [expectedConfirmAt, setExpectedConfirmAt] = useState(initialExpectedConfirmAt);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    setSaved(false);
    setError("");
    if (newStatus === "PRESENT") {
      setSubOption(initialEarlyLeaveTime ? "early" : "normal");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const body: Record<string, string | undefined> = {
      trainingId,
      status,
    };

    if (status === "PRESENT" && subOption === "early") {
      body.earlyLeaveTime = earlyLeaveTime || undefined;
    }
    if (status === "ABSENT") {
      body.reason = reason || undefined;
    }
    if (status === "PENDING") {
      body.expectedConfirmAt = expectedConfirmAt || undefined;
    }

    try {
      const res = await fetch("/api/attendance/self", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">참석 상태 선택</h3>

      {/* 3개 상태 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={() => handleStatusChange("PRESENT")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            status === "PRESENT"
              ? "bg-green-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          참석
        </button>
        <button
          onClick={() => handleStatusChange("ABSENT")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            status === "ABSENT"
              ? "bg-red-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          불참
        </button>
        <button
          onClick={() => handleStatusChange("PENDING")}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            status === "PENDING"
              ? "bg-gray-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          미정
        </button>
      </div>

      {/* 참석 - 서브 옵션 */}
      {status === "PRESENT" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={() => { setSubOption("normal"); setEarlyLeaveTime(""); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                subOption === "normal"
                  ? "border-green-600 bg-green-50 text-green-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              일반 참석
            </button>
            <button
              onClick={() => setSubOption("early")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                subOption === "early"
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              조기퇴소
            </button>
          </div>

          {subOption === "early" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-600">퇴소 시간 선택</label>
              <div className="grid grid-cols-5 gap-1.5">
                {EARLY_LEAVE_TIMES.map((time) => (
                  <button
                    key={time}
                    onClick={() => setEarlyLeaveTime(time)}
                    className={`py-2 rounded-lg text-xs font-medium transition-colors ${
                      earlyLeaveTime === time
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5 leading-relaxed">
            ※ 점심시간은 훈련시간에 미반영됩니다
            <br />
            (브런치 데이: 10:30~11:30 / 일반: 11:30~12:30)
          </p>
        </div>
      )}

      {/* 불참 - 사유 입력 */}
      {status === "ABSENT" && (
        <div>
          <label className="text-xs font-medium text-gray-600">불참 사유</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="불참 사유를 입력해주세요."
            rows={2}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 outline-none resize-none"
          />
        </div>
      )}

      {/* 미정 - 확정 예정 시점 */}
      {status === "PENDING" && (
        <div>
          <label className="text-xs font-medium text-gray-600">확정 예정 시점</label>
          <input
            type="datetime-local"
            value={expectedConfirmAt}
            onChange={(e) => setExpectedConfirmAt(e.target.value)}
            className="mt-1 w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-gray-500 outline-none"
          />
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${
          saved ? "bg-green-600" : "bg-blue-600 hover:bg-blue-700"
        } disabled:opacity-50`}
      >
        {saving ? "저장 중..." : saved ? "저장 완료!" : "저장"}
      </button>
    </div>
  );
}
