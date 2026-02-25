"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { ROLE_LABELS } from "@/lib/constants";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export default function Header({ onMenuToggle }: { onMenuToggle: () => void }) {
  const { data: session } = useSession();
  const unreadCount = useUnreadMessages();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm px-4 py-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="로고" width={28} height={28} className="shrink-0" />
          <span className="text-sm font-bold text-gray-800 sm:hidden">상비예비군</span>
          <span className="text-lg font-semibold text-gray-800 hidden sm:block">
            상비예비군 소집훈련 관리 시스템
          </span>
        </Link>
        <div className="flex items-center gap-4">
          {session?.user && (
            <>
              <Link href="/messages" className="relative p-2 rounded-md hover:bg-gray-100">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_LABELS[session.user.role] || session.user.role}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-sm text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg"
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
