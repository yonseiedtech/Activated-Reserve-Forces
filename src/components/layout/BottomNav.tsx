"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ROLE_LABELS } from "@/lib/constants";
import { getBottomTabs, getMoreMenuItems } from "@/lib/navigation";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export default function BottomNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const unreadCount = useUnreadMessages();

  const role = session?.user?.role || "";
  const tabs = getBottomTabs(role);
  const moreItems = getMoreMenuItems(role);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <>
      {/* 더보기 오버레이 */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMoreOpen(false)}>
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/40" />
          {/* 슬라이드업 패널 */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 핸들 바 */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* 사용자 정보 */}
            {session?.user && (
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-900">{session.user.name}</p>
                <p className="text-sm text-gray-500">{ROLE_LABELS[session.user.role] || session.user.role}</p>
              </div>
            )}

            {/* 메뉴 목록 */}
            <nav className="px-2 py-2">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-lg relative">
                    {item.icon}
                    {item.href === "/messages" && unreadCount > 0 && (
                      <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* 로그아웃 */}
            <div className="px-5 py-3 border-t border-gray-100">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full text-left text-sm text-red-500 hover:text-red-600 py-2"
              >
                로그아웃
              </button>
            </div>

            {/* 하단 safe area 여백 */}
            <div className="h-2" />
          </div>
        </div>
      )}

      {/* 하단 탭 바 */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-t border-gray-100 lg:hidden">
        <div className="flex items-center justify-around h-16 px-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-xs transition-colors ${
                isActive(tab.href)
                  ? "text-blue-600 font-medium"
                  : "text-gray-500"
              }`}
            >
              <span className="text-lg leading-none relative">
                {tab.icon}
                {tab.href === "/messages" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </span>
              <span className="truncate max-w-[60px]">{tab.label}</span>
            </Link>
          ))}
          {/* 더보기 탭 */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-xs transition-colors ${
              moreOpen ? "text-blue-600 font-medium" : "text-gray-500"
            }`}
          >
            <span className="text-lg leading-none">☰</span>
            <span>더보기</span>
          </button>
        </div>
        {/* iOS safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </>
  );
}
