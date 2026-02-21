"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ROLES } from "@/lib/constants";

const navItems = [
  { href: "/", label: "대시보드", icon: "📊", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK, ROLES.RESERVIST] },
  { href: "/trainings", label: "훈련 일정", icon: "📅", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/attendance", label: "참석 관리", icon: "✅", roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { href: "/commuting", label: "출퇴근 기록", icon: "🕐", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/meals", label: "식사 관리", icon: "🍽️", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK] },
  { href: "/payments", label: "훈련비 관리", icon: "💰", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/notices", label: "공지사항", icon: "📢", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK, ROLES.RESERVIST] },
  { href: "/messages", label: "쪽지", icon: "✉️", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK, ROLES.RESERVIST] },
  { href: "/surveys", label: "설문조사", icon: "📝", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/admin", label: "관리자", icon: "⚙️", roles: [ROLES.ADMIN] },
];

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role || "";

  const filteredNav = navItems.filter((item) => (item.roles as string[]).includes(role));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-blue-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-blue-800">
          <h1 className="text-lg font-bold">상비예비군</h1>
          <p className="text-blue-300 text-sm">소집훈련 관리</p>
        </div>
        <nav className="p-2 space-y-1 overflow-y-auto h-[calc(100%-80px)]">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-blue-700 text-white font-medium"
                    : "text-blue-200 hover:bg-blue-800 hover:text-white"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
