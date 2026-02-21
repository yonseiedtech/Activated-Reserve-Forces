"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
import { ROLE_LABELS, RANKS } from "@/lib/constants";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  rank: string | null;
  serviceNumber: string | null;
  phone: string | null;
  unit: string | null;
  batchId: string | null;
  batch: { name: string } | null;
}

interface Batch {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "RESERVIST",
    rank: "", serviceNumber: "", phone: "", unit: "", batchId: "",
  });

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setUsers);
    fetch("/api/batches").then((r) => r.json()).then(setBatches);
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      fetch("/api/users").then((r) => r.json()).then(setUsers);
    }
  };

  const filtered = filter
    ? users.filter((u) => u.role === filter)
    : users;

  return (
    <div>
      <PageTitle
        title="사용자 관리"
        actions={
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 사용자 추가
          </button>
        }
      />

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setFilter("")} className={`px-3 py-1.5 rounded-lg text-sm ${!filter ? "bg-blue-600 text-white" : "bg-gray-100"}`}>전체</button>
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === k ? "bg-blue-600 text-white" : "bg-gray-100"}`}>{v}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">이름</th>
              <th className="text-left px-4 py-3 font-medium">이메일</th>
              <th className="text-left px-4 py-3 font-medium">역할</th>
              <th className="text-left px-4 py-3 font-medium">계급</th>
              <th className="text-left px-4 py-3 font-medium">군번</th>
              <th className="text-left px-4 py-3 font-medium">차수</th>
              <th className="text-left px-4 py-3 font-medium">연락처</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{ROLE_LABELS[u.role] || u.role}</span>
                </td>
                <td className="px-4 py-3">{u.rank || "-"}</td>
                <td className="px-4 py-3">{u.serviceNumber || "-"}</td>
                <td className="px-4 py-3">{u.batch?.name || "-"}</td>
                <td className="px-4 py-3">{u.phone || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">사용자 추가</h3>
            <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="이메일" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="비밀번호" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {form.role === "RESERVIST" && (
              <>
                <select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">계급 선택</option>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <input placeholder="군번" value={form.serviceNumber} onChange={(e) => setForm({ ...form, serviceNumber: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
                <select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">차수 선택</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </>
            )}
            <input placeholder="연락처" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="소속부대" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">생성</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
