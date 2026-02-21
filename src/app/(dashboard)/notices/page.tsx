import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

export default async function NoticesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  const notices = await prisma.notice.findMany({
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <PageTitle
        title="공지사항"
        actions={
          isAdmin ? (
            <Link href="/notices/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + 공지 작성
            </Link>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border divide-y">
        {notices.map((notice) => (
          <Link
            key={notice.id}
            href={`/notices/${notice.id}`}
            className="block p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-2">
              {notice.isPinned && <span className="text-red-500 shrink-0 mt-0.5">📌</span>}
              <div className="flex-1 min-w-0">
                <h3 className={`font-medium truncate ${notice.isPinned ? "text-red-700" : ""}`}>{notice.title}</h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-1">{notice.content}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(notice.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
          </Link>
        ))}
        {notices.length === 0 && (
          <p className="text-center py-8 text-gray-400">등록된 공지사항이 없습니다.</p>
        )}
      </div>
    </div>
  );
}
