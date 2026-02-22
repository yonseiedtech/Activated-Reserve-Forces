"use client";

import { useState } from "react";
import Link from "next/link";

type UserType = "reservist" | "admin";

export default function ResetPasswordPage() {
  const [userType, setUserType] = useState<UserType>("reservist");
  const [identifier, setIdentifier] = useState("");
  const [name, setName] = useState("");
  const [verifyType, setVerifyType] = useState<"serviceNumber" | "phone">("serviceNumber");
  const [serviceNumber, setServiceNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleTabChange = (type: UserType) => {
    setUserType(type);
    setIdentifier("");
    setName("");
    setServiceNumber("");
    setPhone("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setVerifyType("serviceNumber");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (newPassword.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userType,
        identifier,
        name,
        serviceNumber: userType === "admin" && verifyType === "serviceNumber" ? serviceNumber : undefined,
        phone: userType === "reservist" || verifyType === "phone" ? phone : undefined,
        newPassword,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (res.ok) {
      setSuccess(true);
    } else {
      setError(data.error || "비밀번호 변경에 실패했습니다.");
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">비밀번호 변경 완료</h2>
          <p className="text-gray-500 mb-6">새 비밀번호로 로그인해주세요.</p>
          <Link
            href="/login"
            className="inline-block w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            로그인 페이지로 이동
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">비밀번호 찾기</h1>
          <p className="text-gray-500 mt-1">본인 확인 후 비밀번호를 재설정합니다</p>
        </div>

        {/* 탭 UI */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => handleTabChange("reservist")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
              userType === "reservist"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            훈련대상자
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("admin")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
              userType === "admin"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            관리자
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 text-center">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {userType === "reservist" ? "군번" : "아이디"}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder={userType === "reservist" ? "군번을 입력하세요 (예: 22-76001)" : "아이디를 입력하세요"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="이름을 입력하세요"
            />
          </div>

          {userType === "admin" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">본인 확인 방법</label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setVerifyType("serviceNumber")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      verifyType === "serviceNumber"
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    군번
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyType("phone")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      verifyType === "phone"
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "border-gray-300 text-gray-500"
                    }`}
                  >
                    전화번호
                  </button>
                </div>
              </div>

              {verifyType === "serviceNumber" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">군번</label>
                  <input
                    type="text"
                    value={serviceNumber}
                    onChange={(e) => setServiceNumber(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="군번을 입력하세요"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="전화번호를 입력하세요"
                  />
                </div>
              )}
            </>
          )}

          {userType === "reservist" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">본인 확인 방법</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setVerifyType("phone")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                    verifyType === "phone"
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "border-gray-300 text-gray-500"
                  }`}
                >
                  전화번호
                </button>
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="전화번호를 입력하세요"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="새 비밀번호를 입력하세요"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="비밀번호를 다시 입력하세요"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "처리 중..." : "비밀번호 변경"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
            로그인 페이지로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
