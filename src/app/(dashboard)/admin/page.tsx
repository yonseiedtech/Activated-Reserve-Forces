import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/");

  const menus = [
    { href: "/admin/batches", title: "차수 관리", desc: "훈련 차수를 생성/수정/삭제합니다.", icon: "📋" },
    { href: "/admin/users", title: "사용자 관리", desc: "관리자, 담당자, 대상자 계정을 관리합니다.", icon: "👥" },
    { href: "/admin/units", title: "부대 관리", desc: "부대 정보를 등록/수정/삭제합니다.", icon: "🏢" },
    { href: "/admin/locations", title: "GPS 위치 관리", desc: "출퇴근 기준 위치를 등록/수정합니다.", icon: "📍" },
    { href: "/admin/notifications", title: "푸시 알림 발송", desc: "대상자에게 알림을 발송합니다.", icon: "🔔" },
  ];

  return (
    <div>
      <PageTitle title="관리자" description="시스템 전반을 관리합니다." />
      <div className="grid sm:grid-cols-2 gap-4">
        {menus.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow"
          >
            <span className="text-3xl">{m.icon}</span>
            <h3 className="font-semibold mt-3">{m.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
