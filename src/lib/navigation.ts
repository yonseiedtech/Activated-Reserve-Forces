import { ROLES } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: string[];
}

export const navItems: NavItem[] = [
  { href: "/", label: "대시보드", icon: "📊", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK, ROLES.INSTRUCTOR, ROLES.RESERVIST] },
  { href: "/trainings", label: "훈련 과목", icon: "📅", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.INSTRUCTOR, ROLES.RESERVIST] },
  { href: "/batches", label: "차수현황", icon: "📋", roles: [ROLES.RESERVIST] },
  { href: "/admin/batches", label: "훈련차수", icon: "📋", roles: [ROLES.ADMIN, ROLES.MANAGER] },
  { href: "/commuting", label: "출석 리포트", icon: "📈", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.INSTRUCTOR, ROLES.RESERVIST] },
  { href: "/meals", label: "식사 관리", icon: "🍽️", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK] },
  { href: "/payments", label: "훈련비 관리", icon: "💰", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/notices", label: "공지사항", icon: "📢", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK, ROLES.INSTRUCTOR, ROLES.RESERVIST] },
  { href: "/messages", label: "쪽지", icon: "✉️", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.COOK, ROLES.INSTRUCTOR, ROLES.RESERVIST] },
  { href: "/mobile-id", label: "PASS", icon: "🪪", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/surveys", label: "설문조사", icon: "📝", roles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.RESERVIST] },
  { href: "/profile", label: "내 정보", icon: "👤", roles: [ROLES.RESERVIST] },
  { href: "/admin", label: "관리자", icon: "⚙️", roles: [ROLES.ADMIN, ROLES.MANAGER] },
];

export function getFilteredNav(role: string): NavItem[] {
  return navItems.filter((item) => item.roles.includes(role));
}

// 역할별 하단 탭 4개 (+ 더보기는 BottomNav에서 직접 추가)
const bottomTabConfig: Record<string, string[]> = {
  [ROLES.RESERVIST]: ["/notices", "/batches", "/mobile-id", "/commuting"],
  [ROLES.ADMIN]: ["/notices", "/admin/batches", "/", "/payments"],
  [ROLES.MANAGER]: ["/notices", "/admin/batches", "/", "/payments"],
  [ROLES.COOK]: ["/", "/meals", "/notices", "/messages"],
  [ROLES.INSTRUCTOR]: ["/", "/trainings", "/commuting", "/notices"],
};

export function getBottomTabs(role: string): NavItem[] {
  const tabHrefs = bottomTabConfig[role] || bottomTabConfig[ROLES.RESERVIST];
  return tabHrefs.map((href) => navItems.find((n) => n.href === href)!).filter(Boolean);
}

export function getMoreMenuItems(role: string): NavItem[] {
  const tabHrefs = new Set(bottomTabConfig[role] || bottomTabConfig[ROLES.RESERVIST]);
  return getFilteredNav(role).filter((item) => !tabHrefs.has(item.href));
}
