"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
import { ROLE_LABELS, RANKS } from "@/lib/constants";

interface User {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  rank: string | null;
  serviceNumber: string | null;
  phone: string | null;
  unit: string | null;
  batchId: string | null;
  birthDate: string | null;
  batch: { name: string } | null;
}

interface Batch {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    name: "", username: "", password: "", role: "RESERVIST",
    rank: "", serviceNumber: "", phone: "", unit: "", batchId: "",
  });

  // 비밀번호 초기화 모달 상태
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  // 편집 모달 상태
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", rank: "", serviceNumber: "", unit: "", phone: "", batchId: "", birthDate: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const fetchUsers = () => fetch("/api/users").then((r) => r.json()).then(setUsers);

  useEffect(() => {
    fetchUsers();
    fetch("/api/batches").then((r) => r.json()).then(setBatches);
    fetch("/api/units").then((r) => r.json()).then(setUnits);
  }, []);

  const handleCreate = async () => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", username: "", password: "", role: "RESERVIST", rank: "", serviceNumber: "", phone: "", unit: "", batchId: "" });
      fetchUsers();
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || !resetPassword) return;
    setResetLoading(true);
    setResetMessage("");

    const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: resetPassword }),
    });

    setResetLoading(false);

    if (res.ok) {
      setResetMessage("비밀번호가 초기화되었습니다.");
      setTimeout(() => {
        setResetTarget(null);
        setResetPassword("");
        setResetMessage("");
      }, 1500);
    } else {
      setResetMessage("비밀번호 초기화에 실패했습니다.");
    }
  };

  const handleEditOpen = (user: User) => {
    setEditTarget(user);
    setEditForm({
      name: user.name,
      rank: user.rank || "",
      serviceNumber: user.serviceNumber || "",
      unit: user.unit || "",
      phone: user.phone || "",
      batchId: user.batchId || "",
      birthDate: user.birthDate ? user.birthDate.split("T")[0] : "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditLoading(true);

    const res = await fetch(`/api/users/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    setEditLoading(false);

    if (res.ok) {
      setEditTarget(null);
      fetchUsers();
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
      <div className="flex gap-2 mb-4 flex-wrap">
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
              <th className="text-left px-4 py-3 font-medium">아이디</th>
              <th className="text-left px-4 py-3 font-medium">역할</th>
              <th className="text-left px-4 py-3 font-medium">계급</th>
              <th className="text-left px-4 py-3 font-medium">군번</th>
              <th className="text-left px-4 py-3 font-medium">차수</th>
              <th className="text-left px-4 py-3 font-medium">연락처</th>
              <th className="text-left px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.username}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{ROLE_LABELS[u.role] || u.role}</span>
                </td>
                <td className="px-4 py-3">{u.rank || "-"}</td>
                <td className="px-4 py-3">{u.serviceNumber || "-"}</td>
                <td className="px-4 py-3">{u.batch?.name || "-"}</td>
                <td className="px-4 py-3">{u.phone || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEditOpen(u)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                    >
                      편집
                    </button>
                    <button
                      onClick={() => setResetTarget(u)}
                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                    >
                      비밀번호
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 사용자 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">사용자 추가</h3>
            <input placeholder="이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="아이디" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
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
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
              <option value="">소속부대 선택</option>
              {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
            </select>
            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">생성</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모달 */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">사용자 편집</h3>
            <p className="text-sm text-gray-500">{editTarget.username} ({ROLE_LABELS[editTarget.role] || editTarget.role})</p>
            <div>
              <label className="text-sm font-medium">이름</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">계급</label>
              <select value={editForm.rank} onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택 안함</option>
                {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">군번</label>
              <input value={editForm.serviceNumber} onChange={(e) => setEditForm({ ...editForm, serviceNumber: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">소속부대</label>
              <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택 안함</option>
                {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">연락처</label>
              <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">차수</label>
              <select value={editForm.batchId} onChange={(e) => setEditForm({ ...editForm, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택 안함</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">생년월일</label>
              <input type="date" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {editLoading ? "저장 중..." : "저장"}
              </button>
              <button onClick={() => setEditTarget(null)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 초기화 모달 */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">비밀번호 초기화</h3>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{resetTarget.name}</span> ({resetTarget.username}) 계정의 비밀번호를 초기화합니다.
            </p>
            <input
              placeholder="새 비밀번호"
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {resetMessage && (
              <p className={`text-sm ${resetMessage.includes("실패") ? "text-red-600" : "text-green-600"}`}>
                {resetMessage}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || !resetPassword}
                className="flex-1 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50"
              >
                {resetLoading ? "처리 중..." : "초기화"}
              </button>
              <button
                onClick={() => { setResetTarget(null); setResetPassword(""); setResetMessage(""); }}
                className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
