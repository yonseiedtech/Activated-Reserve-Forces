"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageTitle from "@/components/ui/PageTitle";

export default function EditNoticePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", content: "", isPinned: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/notices/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({ title: data.title, content: data.content, isPinned: data.isPinned });
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/notices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push(`/notices/${id}`);
      router.refresh();
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.back()}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        &larr; 뒤로
      </button>
      <PageTitle title="공지 수정" />
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            required
            rows={10}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isPinned}
            onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">상단 고정</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
