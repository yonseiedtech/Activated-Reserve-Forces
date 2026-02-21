import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import PageTitle from "@/components/ui/PageTitle";
import Link from "next/link";
import DeleteNoticeButton from "./DeleteButton";

export default async function NoticeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { id } = await params;
  const notice = await prisma.notice.findUnique({ where: { id } });
  if (!notice) return notFound();

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  return (
    <div className="max-w-3xl">
      <PageTitle
        title={notice.title}
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <DeleteNoticeButton id={notice.id} />
            </div>
          ) : undefined
        }
      />
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center gap-3 text-sm text-gray-500 mb-4 pb-4 border-b">
          {notice.isPinned && <span className="text-red-500">📌 고정</span>}
          <span>{new Date(notice.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div className="prose prose-sm max-w-none whitespace-pre-wrap">
          {notice.content}
        </div>
      </div>
      <Link href="/notices" className="inline-block mt-4 text-sm text-blue-600 hover:underline">
        &larr; 목록으로
      </Link>
    </div>
  );
}
