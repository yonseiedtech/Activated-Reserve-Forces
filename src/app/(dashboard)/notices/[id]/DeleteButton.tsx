"use client";

import { useRouter } from "next/navigation";

export default function DeleteNoticeButton({ id }: { id: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("공지사항을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/notices/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/notices");
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleDelete}
      className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50"
    >
      삭제
    </button>
  );
}
