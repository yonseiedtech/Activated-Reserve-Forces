"use client";

import { useState } from "react";
import { usePushSubscription } from "@/hooks/usePushSubscription";

export default function PushNotificationBanner() {
  const { permissionState, isSubscribed, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // 표시 조건: prompt 상태 + 미구독 + 미닫힘
  if (permissionState !== "prompt" || isSubscribed || dismissed) return null;

  const handleSubscribe = async () => {
    setLoading(true);
    await subscribe();
    setLoading(false);
  };

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <svg className="w-5 h-5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <p className="text-sm text-blue-800">
          알림을 켜면 훈련 공지를 바로 받을 수 있습니다.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "..." : "알림 켜기"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 text-blue-400 hover:text-blue-600 transition-colors"
          aria-label="닫기"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
