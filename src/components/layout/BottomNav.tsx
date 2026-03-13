"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ROLE_LABELS } from "@/lib/constants";
import { getBottomTabs, getMoreMenuItems } from "@/lib/navigation";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const CLOSE_THRESHOLD = 80;

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

  // 드래그 상태 (ref로 관리하여 클로저 문제 방지)
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const closeSheet = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setMoreOpen(false);
      setIsClosing(false);
      setDragOffset(0);
      dragOffsetRef.current = 0;
    }, 200);
  }, []);

  // 터치 드래그 핸들러
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    isDraggingRef.current = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) {
      dragOffsetRef.current = diff;
      setDragOffset(diff);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (dragOffsetRef.current > CLOSE_THRESHOLD) {
      closeSheet();
    } else {
      dragOffsetRef.current = 0;
      setDragOffset(0);
    }
  }, [closeSheet]);

  // moreOpen 변경 시 body 스크롤 잠금
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [moreOpen]);

  return (
    <>
      {/* 더보기 바텀시트 */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={closeSheet}>
          {/* 배경 딤 */}
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
              isClosing ? "opacity-0" : "opacity-100"
            }`}
          />
          {/* 바텀시트 패널 */}
          <div
            ref={sheetRef}
            className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl ${
              isClosing ? "animate-slide-down" : "animate-slide-up"
            }`}
            style={{
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
              transition: dragOffset > 0 ? "none" : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* 드래그 핸들 */}
            <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* 사용자 정보 */}
            {session?.user && (
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="font-semibold text-gray-900">{session.user.name}</p>
                <p className="text-sm text-gray-500">{ROLE_LABELS[session.user.role] || session.user.role}</p>
              </div>
            )}

            {/* 메뉴 목록 */}
            <nav className="px-2 py-2 max-h-[50vh] overflow-y-auto overscroll-contain">
              {moreItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => { setMoreOpen(false); setDragOffset(0); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${
                    isActive(item.href)
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
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
            <div className="h-[env(safe-area-inset-bottom)]" />
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
            onClick={() => {
              if (moreOpen) {
                closeSheet();
              } else {
                setMoreOpen(true);
              }
            }}
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
