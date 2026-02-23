"use client";

import { useEffect, useState, useCallback } from "react";
import { signIn } from "next-auth/react";
import Script from "next/script";
import PageTitle from "@/components/ui/PageTitle";
import { ROLE_LABELS, RANKS } from "@/lib/constants";
import { formatPhone, formatServiceNumber, formatBirthDate } from "@/lib/formatters";

interface TransportCalcResult {
  km: number;
  hasToll: boolean;
  tollFare: number;
  total: number;
  fuel: number;
  toll: number;
}

interface User {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  rank: string | null;
  serviceNumber: string | null;
  uniqueNumber: string | null;
  phone: string | null;
  unit: string | null;
  birthDate: string | null;
  branch: string | null;
  warBattalion: string | null;
  warCompany: string | null;
  warPlatoon: string | null;
  warPosition: string | null;
  zipCode: string | null;
  address: string | null;
  addressDetail: string | null;
  batches: { id: string; name: string }[];
}

interface Batch {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

type SortKey = "name" | "username" | "role" | "rank" | "serviceNumber" | "phone";
type SortDir = "asc" | "desc";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    name: "", username: "", password: "", role: "RESERVIST",
    rank: "", serviceNumber: "", phone: "", unit: "", batchId: "",
  });

  // 정렬
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // 비밀번호 초기화 모달 상태
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  // 편집 모달 상태
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    username: "", name: "", rank: "", serviceNumber: "", uniqueNumber: "", unit: "", phone: "", birthDate: "",
    branch: "", warBattalion: "", warCompany: "", warPlatoon: "", warPosition: "",
    zipCode: "", address: "", addressDetail: "",
  });
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // CSV 일괄 등록 모달 상태
  const [showCsvUpload, setShowCsvUpload] = useState(false);
  const [csvData, setCsvData] = useState<Array<Record<string, string>>>([]);
  const [csvError, setCsvError] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvResult, setCsvResult] = useState("");

  const safeFetch = async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401) {
        signIn();
        throw new Error("인증이 만료되었습니다. 로그인 페이지로 이동합니다.");
      }
      throw new Error(`요청 실패 (${res.status})`);
    }
    return res.json();
  };

  const fetchAll = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersData, batchesData, unitsData] = await Promise.all([
        safeFetch("/api/users"),
        safeFetch("/api/batches"),
        safeFetch("/api/units"),
      ]);
      setUsers(usersData);
      setBatches(batchesData);
      setUnits(unitsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터를 불러오는 데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const [createError, setCreateError] = useState("");

  const handleCreate = async () => {
    setCreateError("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", username: "", password: "", role: "RESERVIST", rank: "", serviceNumber: "", phone: "", unit: "", batchId: "" });
      fetchAll();
    } else {
      const err = await res.json();
      setCreateError(err.error || "사용자 추가에 실패했습니다.");
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
    setEditError("");
    setEditSuccess(false);
    setEditForm({
      username: user.username,
      name: user.name,
      rank: user.rank || "",
      serviceNumber: user.serviceNumber || "",
      uniqueNumber: user.uniqueNumber || "",
      unit: user.unit || "",
      phone: user.phone || "",
      birthDate: user.birthDate ? user.birthDate.split("T")[0] : "",
      branch: user.branch || "",
      warBattalion: user.warBattalion || "",
      warCompany: user.warCompany || "",
      warPlatoon: user.warPlatoon || "",
      warPosition: user.warPosition || "",
      zipCode: user.zipCode || "",
      address: user.address || "",
      addressDetail: user.addressDetail || "",
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditLoading(true);
    setEditError("");
    setEditSuccess(false);

    const res = await fetch(`/api/users/${editTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });

    setEditLoading(false);

    if (res.ok) {
      setEditSuccess(true);
      // 목록 데이터를 백그라운드에서 갱신 (모달은 열린 상태 유지)
      fetchAll();
    } else {
      const err = await res.json();
      setEditError(err.error || "저장에 실패했습니다.");
    }
  };

  const handleEditAddressSearch = () => {
    if (typeof window === "undefined" || !window.daum) return;
    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        setEditForm((prev) => ({
          ...prev,
          zipCode: data.zonecode,
          address: data.roadAddress || data.jibunAddress,
        }));
      },
    }).open();
  };

  const handleEditClose = () => {
    setEditTarget(null);
    setEditSuccess(false);
    setEditError("");
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError("");
    setCsvResult("");

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        setCsvError("헤더와 최소 1행의 데이터가 필요합니다.");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim());
      const requiredHeaders = ["name", "username", "password"];
      const missing = requiredHeaders.filter((h) => !headers.includes(h));
      if (missing.length > 0) {
        setCsvError(`필수 헤더 누락: ${missing.join(", ")}`);
        return;
      }
      const rows = lines.slice(1).map((line) => {
        const values = line.split(",").map((v) => v.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ""; });
        return row;
      });
      setCsvData(rows);
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (csvData.length === 0) return;
    setCsvLoading(true);
    setCsvError("");
    setCsvResult("");

    const res = await fetch("/api/users/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: csvData }),
    });

    setCsvLoading(false);
    if (res.ok) {
      const data = await res.json();
      setCsvResult(`${data.created}명이 등록되었습니다.`);
      fetchAll();
      setCsvData([]);
    } else {
      const err = await res.json();
      setCsvError(err.error || "등록에 실패했습니다.");
    }
  };

  const [searchQuery, setSearchQuery] = useState("");

  const filtered = users.filter((u) => {
    const matchesRole = !filter || u.role === filter;
    const matchesSearch = !searchQuery ||
      u.name.includes(searchQuery) ||
      u.serviceNumber?.includes(searchQuery) ||
      u.unit?.includes(searchQuery) ||
      u.username.includes(searchQuery);
    return matchesRole && matchesSearch;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const getSortValue = (u: User, key: SortKey): string => {
    switch (key) {
      case "name": return u.name;
      case "username": return u.username;
      case "role": return u.role;
      case "rank": return u.rank || "";
      case "serviceNumber": return u.serviceNumber || "";
      case "phone": return u.phone || "";
      default: return "";
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    const cmp = av.localeCompare(bv, "ko-KR");
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortArrow = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>;
  };

  return (
    <div>
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />
      <PageTitle
        title="사용자 관리"
        actions={
          <div className="flex gap-2">
            <button onClick={() => setShowCsvUpload(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
              CSV 일괄 등록
            </button>
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              + 사용자 추가
            </button>
          </div>
        }
      />

      {/* 검색 */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="이름, 군번, 부대명, 아이디로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-80 px-3 py-2 border rounded-lg text-sm"
        />
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilter("")} className={`px-3 py-1.5 rounded-lg text-sm ${!filter ? "bg-blue-600 text-white" : "bg-gray-100"}`}>전체</button>
        {Object.entries(ROLE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === k ? "bg-blue-600 text-white" : "bg-gray-100"}`}>{v}</button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-500">
          데이터를 불러오는 중...
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 mb-3">{error}</p>
          <button
            onClick={fetchAll}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
        {/* Desktop: 테이블 */}
        <div className="hidden lg:block bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th onClick={() => handleSort("name")} className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 select-none">이름<SortArrow col="name" /></th>
                <th onClick={() => handleSort("username")} className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 select-none">아이디<SortArrow col="username" /></th>
                <th onClick={() => handleSort("role")} className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 select-none">역할<SortArrow col="role" /></th>
                <th onClick={() => handleSort("rank")} className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 select-none">계급<SortArrow col="rank" /></th>
                <th onClick={() => handleSort("serviceNumber")} className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 select-none">군번<SortArrow col="serviceNumber" /></th>
                <th onClick={() => handleSort("phone")} className="text-left px-4 py-3 font-medium cursor-pointer hover:bg-gray-100 select-none">연락처<SortArrow col="phone" /></th>
                <th className="text-left px-4 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    {searchQuery || filter ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
                  </td>
                </tr>
              ) : sorted.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{ROLE_LABELS[u.role] || u.role}</span>
                  </td>
                  <td className="px-4 py-3">{u.rank || "-"}</td>
                  <td className="px-4 py-3">{u.serviceNumber || "-"}</td>
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

        {/* Mobile: 카드 리스트 */}
        <div className="lg:hidden space-y-3">
          {sorted.length === 0 ? (
            <p className="text-center py-12 text-gray-400">
              {searchQuery || filter ? "검색 결과가 없습니다." : "등록된 사용자가 없습니다."}
            </p>
          ) : sorted.map((u) => (
            <div key={u.id} className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">{u.name}</div>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{ROLE_LABELS[u.role] || u.role}</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                {u.rank && <p>계급: {u.rank}</p>}
                {u.serviceNumber && <p>군번: {u.serviceNumber}</p>}
                {u.phone && <p>연락처: {u.phone}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditOpen(u)}
                  className="flex-1 px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium"
                >
                  편집
                </button>
                <button
                  onClick={() => setResetTarget(u)}
                  className="flex-1 px-3 py-1.5 text-xs bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 font-medium"
                >
                  비밀번호
                </button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* 사용자 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-3 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">사용자 추가</h3>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
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
                <input placeholder="군번 (예: 1212345678)" value={form.serviceNumber} onChange={(e) => setForm({ ...form, serviceNumber: formatServiceNumber(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
                <select value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                  <option value="">차수 선택</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </>
            )}
            <input placeholder="연락처 (예: 01012345678)" value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
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
            <h3 className="text-lg font-semibold">{editTarget.name} 편집</h3>
            <p className="text-sm text-gray-500">{ROLE_LABELS[editTarget.role] || editTarget.role}</p>
            {editError && <p className="text-sm text-red-600">{editError}</p>}
            {editSuccess && <p className="text-sm text-green-600">저장이 완료되었습니다.</p>}
            <div>
              <label className="text-sm font-medium">아이디</label>
              <input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
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
              <input placeholder="예: 1212345678" value={editForm.serviceNumber} onChange={(e) => setEditForm({ ...editForm, serviceNumber: formatServiceNumber(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">고유번호</label>
              <input placeholder="예: RES-2026-00001" value={editForm.uniqueNumber} onChange={(e) => setEditForm({ ...editForm, uniqueNumber: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">병과</label>
              <input placeholder="예: 보병, 포병, 공병" value={editForm.branch} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">훈련부대</label>
              <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                <option value="">선택 안함</option>
                {units.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">연락처</label>
              <input placeholder="예: 01012345678" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">생년월일</label>
              <input placeholder="예: 950315 또는 19950315" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: formatBirthDate(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
              {editForm.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(editForm.birthDate) && (
                <p className="text-xs text-gray-400 mt-1">{new Date(editForm.birthDate).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>
              )}
            </div>

            {/* 전시편성 */}
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">전시편성</p>
            </div>
            <div>
              <label className="text-sm font-medium">전시부대 (대대)</label>
              <input placeholder="전시 대대" value={editForm.warBattalion} onChange={(e) => setEditForm({ ...editForm, warBattalion: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">전시부대 (중대)</label>
              <input placeholder="전시 중대" value={editForm.warCompany} onChange={(e) => setEditForm({ ...editForm, warCompany: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">전시부대 (소대/지휘부)</label>
              <input placeholder="전시 소대/지휘부" value={editForm.warPlatoon} onChange={(e) => setEditForm({ ...editForm, warPlatoon: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="text-sm font-medium">전시직책</label>
              <input placeholder="전시직책" value={editForm.warPosition} onChange={(e) => setEditForm({ ...editForm, warPosition: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            </div>

            {/* 주소 */}
            <div className="border-t pt-3 mt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">주소</p>
            </div>
            <div>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={editForm.zipCode}
                  readOnly
                  placeholder="우편번호"
                  className="w-28 px-3 py-2 text-sm border rounded-lg bg-gray-50 outline-none"
                />
                <button
                  type="button"
                  onClick={handleEditAddressSearch}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border shrink-0"
                >
                  우편번호 검색
                </button>
              </div>
              <input
                type="text"
                value={editForm.address}
                readOnly
                placeholder="기본 주소"
                className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 outline-none mb-2"
              />
              <input
                type="text"
                value={editForm.addressDetail}
                onChange={(e) => setEditForm({ ...editForm, addressDetail: e.target.value })}
                placeholder="상세 주소 입력"
                className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 교통비 정보 */}
            {editForm.address && editForm.unit && (
              <EditTransportInfo address={editForm.address} unitName={editForm.unit} />
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleEditSave}
                disabled={editLoading}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {editLoading ? "저장 중..." : "저장"}
              </button>
              <button onClick={handleEditClose} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">닫기</button>
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

      {/* CSV 일괄 등록 모달 */}
      {showCsvUpload && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">CSV 일괄 등록</h3>
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
              <p className="font-medium">CSV 파일 형식:</p>
              <p>필수 헤더: <code className="bg-gray-200 px-1 rounded">name,username,password</code></p>
              <p>선택 헤더: <code className="bg-gray-200 px-1 rounded">role,rank,serviceNumber,phone,unit,branch,warBattalion,warCompany,warPlatoon,warPosition</code></p>
              <p className="mt-1 text-gray-500">예: 홍길동,hong123,pass1234,RESERVIST,병장,12-12345678,010-1234-5678,00사단</p>
            </div>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFile}
              className="w-full text-sm"
            />
            {csvData.length > 0 && (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-blue-700 font-medium">{csvData.length}명의 데이터가 준비되었습니다.</p>
                <div className="mt-2 max-h-32 overflow-y-auto text-xs text-gray-600">
                  {csvData.slice(0, 5).map((row, i) => (
                    <p key={i}>{row.name} ({row.username}) - {row.rank || "계급없음"}</p>
                  ))}
                  {csvData.length > 5 && <p>... 외 {csvData.length - 5}명</p>}
                </div>
              </div>
            )}
            {csvError && <p className="text-sm text-red-600 whitespace-pre-wrap">{csvError}</p>}
            {csvResult && <p className="text-sm text-green-600">{csvResult}</p>}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCsvUpload}
                disabled={csvLoading || csvData.length === 0}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {csvLoading ? "등록 중..." : `${csvData.length}명 등록`}
              </button>
              <button
                onClick={() => { setShowCsvUpload(false); setCsvData([]); setCsvError(""); setCsvResult(""); }}
                className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 편집 모달용 교통비 정보 컴포넌트 ──
function EditTransportInfo({ address, unitName }: { address: string; unitName: string }) {
  const [transport, setTransport] = useState<TransportCalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchTransport = useCallback(async () => {
    if (!address || !unitName) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/transport-calc?address=${encodeURIComponent(address)}&unitName=${encodeURIComponent(unitName)}`);
      const data = await res.json();
      if (res.ok) {
        setTransport(data);
      } else {
        setError(data.error || "교통비 계산 실패");
        setTransport(null);
      }
    } catch {
      setError("교통비 계산 오류");
      setTransport(null);
    } finally {
      setLoading(false);
    }
  }, [address, unitName]);

  useEffect(() => {
    fetchTransport();
  }, [fetchTransport]);

  return (
    <div className="border-t pt-3 mt-3">
      <p className="text-sm font-semibold text-gray-700 mb-2">교통비 정보</p>
      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" />
          계산 중...
        </div>
      )}
      {error && <p className="text-xs text-orange-600">{error}</p>}
      {transport && (
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">이동거리</span>
            <span className="font-medium">{transport.km} km</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">유료도로</span>
            <span className="font-medium">{transport.hasToll ? "포함" : "미포함"}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">교통비</span>
            <span className="font-bold text-blue-600">{transport.total.toLocaleString()}원</span>
          </div>
        </div>
      )}
      {!loading && !error && !transport && (
        <p className="text-xs text-gray-400">부대 좌표 미등록</p>
      )}
    </div>
  );
}
