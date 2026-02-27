"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import PasswordInput from "@/components/ui/PasswordInput";

type LoginType = "reservist" | "admin";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginType, setLoginType] = useState<LoginType>("reservist");

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "admin") setLoginType("admin");
  }, [searchParams]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showChangeAlert, setShowChangeAlert] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null);

  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // 페이지 로드 시 자동 포커스
  useEffect(() => {
    identifierRef.current?.focus();
  }, []);

  const handleTabChange = (type: LoginType) => {
    setLoginType(type);
    setIdentifier("");
    setPassword("");
    setError("");
    setRemainingAttempts(null);
    setLockedMinutes(null);
    // 탭 전환 시 identifier에 포커스
    setTimeout(() => identifierRef.current?.focus(), 0);
  };

  const fetchLoginCheck = async () => {
    if (!identifier) return;
    try {
      const res = await fetch("/api/auth/login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, loginType }),
      });
      const data = await res.json();
      if (res.status === 429) {
        setLockedMinutes(data.remainingMinutes);
        setRemainingAttempts(0);
        return false;
      }
      setRemainingAttempts(data.remainingAttempts);
      setLockedMinutes(null);
      return true;
    } catch {
      return true;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLockedMinutes(null);
    setLoading(true);

    const result = await signIn("credentials", {
      identifier,
      password,
      loginType,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      if (result.error === "RATE_LIMITED") {
        // 잠금 상태 — login-check API로 남은 시간 조회
        await fetchLoginCheck();
        setError("로그인 시도 횟수를 초과했습니다.");
      } else {
        // 일반 실패 — 남은 횟수 조회
        const allowed = await fetchLoginCheck();
        if (allowed === false) {
          setError("로그인 시도 횟수를 초과했습니다.");
        } else {
          setError(
            loginType === "reservist"
              ? "군번 또는 비밀번호가 올바르지 않습니다."
              : "아이디 또는 비밀번호가 올바르지 않습니다."
          );
        }
      }
    } else {
      setRemainingAttempts(null);
      // 세션에서 mustChangePassword 확인
      const sessionRes = await fetch("/api/auth/session");
      const sessionData = await sessionRes.json();
      if (sessionData?.user?.mustChangePassword) {
        setShowChangeAlert(true);
      } else {
        router.push("/");
        router.refresh();
      }
    }
  };

  const isLocked = lockedMinutes !== null && lockedMinutes > 0;

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">상비예비군</h1>
          <p className="text-gray-500 mt-1">소집훈련 관리 시스템</p>
        </div>

        {/* 탭 UI */}
        <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => handleTabChange("reservist")}
            className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
              loginType === "reservist"
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
              loginType === "admin"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            관리자
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 잠금 경고 */}
          {isLocked && (
            <div
              role="alert"
              className="bg-orange-50 border border-orange-200 text-orange-700 text-sm rounded-lg p-3 text-center"
            >
              로그인이 일시 잠금되었습니다.
              <br />
              약 <strong>{lockedMinutes}분</strong> 후에 다시 시도해주세요.
            </div>
          )}

          {/* 일반 에러 */}
          {error && !isLocked && (
            <div role="alert" className="bg-red-50 text-red-600 text-sm rounded-lg p-3 text-center">
              {error}
              {remainingAttempts !== null && remainingAttempts <= 3 && remainingAttempts > 0 && (
                <p className="mt-1 font-medium">
                  남은 시도 횟수: {remainingAttempts}회
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
              {loginType === "reservist" ? "군번" : "아이디"}
            </label>
            <input
              ref={identifierRef}
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder={loginType === "reservist" ? "군번 (예: 22-76001)" : "아이디를 입력하세요"}
            />
          </div>

          <PasswordInput
            ref={passwordRef}
            id="password"
            label="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder={loginType === "reservist" ? "생년월일 6자리 (예: 980315)" : "비밀번호를 입력하세요"}
          />

          {loginType === "reservist" && (
            <p className="text-xs text-gray-400 -mt-2">
              초기 비밀번호는 생년월일 6자리입니다
            </p>
          )}

          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/reset-password" className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </div>

      {/* 초기 비밀번호 변경 안내 팝업 */}
      {showChangeAlert && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center shadow-2xl animate-in fade-in">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">비밀번호 변경 필요</h3>
            <p className="text-sm text-gray-600 mb-1">
              현재 초기 비밀번호를 사용 중입니다.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              보안을 위해 <span className="font-semibold text-orange-600">새 비밀번호를 설정</span>해야 서비스를 이용할 수 있습니다.
            </p>
            <button
              onClick={() => { router.push("/change-password"); }}
              className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors"
            >
              비밀번호 변경하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
