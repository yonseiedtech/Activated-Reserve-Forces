"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";
import { formatPhone } from "@/lib/formatters";

interface BankUser {
  id: string;
  name: string;
  rank: string | null;
  serviceNumber: string | null;
  unit: string | null;
  bankName: string | null;
  bankAccount: string | null;
  phone: string | null;
}

type FilterType = "" | "registered" | "unregistered";

export default function BankAccountsPage() {
  const [users, setUsers] = useState<BankUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("");

  const fetchUsers = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filter) params.set("filter", filter);
    const res = await fetch(`/api/bank-accounts?${params}`);
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const unregisteredCount = users.filter(
    (u) => !u.bankName || !u.bankAccount
  ).length;

  const downloadCSV = () => {
    const header = "이름,계급,군번,소속,은행명,계좌번호,연락처";
    const rows = users.map((u) =>
      [
        u.name,
        u.rank || "",
        u.serviceNumber || "",
        u.unit || "",
        u.bankName || "",
        u.bankAccount || "",
        u.phone ? formatPhone(u.phone) : "",
      ]
        .map((v) => `"${v}"`)
        .join(",")
    );
    const bom = "\uFEFF";
    const blob = new Blob([bom + header + "\n" + rows.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `계좌목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageTitle
        title="계좌 관리"
        description="예비군 대상자의 보상금 지급용 계좌번호를 조회합니다."
      />

      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input
            type="text"
            placeholder="이름 또는 군번 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded-lg px-3 py-2 flex-1 text-sm"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
          >
            검색
          </button>
        </form>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            <option value="registered">등록완료</option>
            <option value="unregistered">미등록</option>
          </select>
          <button
            onClick={downloadCSV}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
          >
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 통계 */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-gray-600">
          총 <b>{users.length}</b>명
        </span>
        {unregisteredCount > 0 && (
          <span className="text-red-600">
            미등록 <b>{unregisteredCount}</b>명
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">불러오는 중...</p>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-400 py-10">
          검색 결과가 없습니다.
        </p>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-3 font-medium">이름</th>
                  <th className="text-left p-3 font-medium">계급</th>
                  <th className="text-left p-3 font-medium">군번</th>
                  <th className="text-left p-3 font-medium">소속</th>
                  <th className="text-left p-3 font-medium">은행명</th>
                  <th className="text-left p-3 font-medium">계좌번호</th>
                  <th className="text-left p-3 font-medium">연락처</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">{u.name}</td>
                    <td className="p-3">{u.rank || "-"}</td>
                    <td className="p-3">{u.serviceNumber || "-"}</td>
                    <td className="p-3">{u.unit || "-"}</td>
                    <td className="p-3">
                      {u.bankName || (
                        <span className="text-red-400">미등록</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.bankAccount || (
                        <span className="text-red-400">미등록</span>
                      )}
                    </td>
                    <td className="p-3">
                      {u.phone ? formatPhone(u.phone) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="sm:hidden space-y-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="bg-white rounded-xl border p-4 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{u.name}</span>
                  <span className="text-xs text-gray-500">
                    {u.rank || ""} {u.serviceNumber || ""}
                  </span>
                </div>
                {u.unit && (
                  <p className="text-xs text-gray-500">{u.unit}</p>
                )}
                <div className="text-sm">
                  {u.bankName && u.bankAccount ? (
                    <p>
                      {u.bankName} {u.bankAccount}
                    </p>
                  ) : (
                    <p className="text-red-400">계좌 미등록</p>
                  )}
                </div>
                {u.phone && (
                  <p className="text-xs text-gray-500">
                    {formatPhone(u.phone)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
