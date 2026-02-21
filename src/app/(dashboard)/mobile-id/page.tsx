"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PageTitle from "@/components/ui/PageTitle";

interface IdCardData {
  id: string;
  uniqueNumber: string;
  validFrom: string;
  validUntil: string;
  isApproved: boolean;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  user: {
    name: string;
    rank: string | null;
    serviceNumber: string | null;
    unit: string | null;
    position: string | null;
    birthDate: string | null;
    batch: { name: string; startDate: string; endDate: string } | null;
  };
  approvedBy: { name: string } | null;
}

export default function MobileIdPage() {
  const { data: session } = useSession();
  const [card, setCard] = useState<IdCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "MANAGER";

  useEffect(() => {
    fetch("/api/mobile-id")
      .then((r) => r.json())
      .then((data) => {
        setCard(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleRequest = async () => {
    setRequesting(true);
    const res = await fetch("/api/mobile-id", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      // 다시 상세 조회
      const detail = await fetch("/api/mobile-id").then((r) => r.json());
      setCard(detail);
    }
    setRequesting(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // 관리자에게는 관리 페이지 안내
  if (isAdmin) {
    return (
      <div>
        <PageTitle title="모바일 신분증" description="신분증 발급 승인을 관리합니다." />
        <AdminIdCardList />
      </div>
    );
  }

  // 신분증 미발급 상태
  if (!card) {
    return (
      <div>
        <PageTitle title="모바일 신분증" />
        <div className="max-w-sm mx-auto text-center py-12">
          <div className="text-6xl mb-4">🪪</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">모바일 신분증 미발급</h3>
          <p className="text-sm text-gray-500 mb-6">
            소집훈련 입/퇴영 시 사용할 모바일 신분증을 발급 신청하세요.
          </p>
          <button
            onClick={handleRequest}
            disabled={requesting}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {requesting ? "신청 중..." : "발급 신청"}
          </button>
        </div>
      </div>
    );
  }

  // 반려된 경우
  if (card.rejectedAt && !card.isApproved) {
    return (
      <div>
        <PageTitle title="모바일 신분증" />
        <div className="max-w-sm mx-auto text-center py-12">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-lg font-semibold text-red-700 mb-2">발급 반려</h3>
          <p className="text-sm text-gray-500 mb-2">신분증 발급이 반려되었습니다.</p>
          {card.rejectReason && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">
              사유: {card.rejectReason}
            </p>
          )}
        </div>
      </div>
    );
  }

  // 승인 대기 중
  if (!card.isApproved) {
    return (
      <div>
        <PageTitle title="모바일 신분증" />
        <div className="max-w-sm mx-auto text-center py-12">
          <div className="text-6xl mb-4">⏳</div>
          <h3 className="text-lg font-semibold text-yellow-700 mb-2">승인 대기 중</h3>
          <p className="text-sm text-gray-500">
            관리자의 승인을 기다리고 있습니다.<br />
            고유번호: <span className="font-mono font-medium">{card.uniqueNumber}</span>
          </p>
        </div>
      </div>
    );
  }

  // 유효기간 체크
  const now = new Date();
  const validUntil = new Date(card.validUntil);
  const isExpired = now > validUntil;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  const formatBirthDate = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  // 승인된 신분증 카드 UI
  return (
    <div>
      <PageTitle title="모바일 신분증" />

      <div className="max-w-sm mx-auto">
        {/* === 신분증 카드 === */}
        <div className={`relative rounded-2xl overflow-hidden shadow-xl ${isExpired ? "opacity-60" : ""}`}>
          {/* 상단 헤더 */}
          <div className="bg-gradient-to-r from-green-800 via-green-700 to-green-800 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-200 text-[10px] tracking-widest uppercase">Republic of Korea Army</p>
                <h2 className="text-white text-lg font-bold tracking-wide">모바일 신분증</h2>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>

          {/* 카드 바디 */}
          <div className="bg-gradient-to-b from-white to-gray-50 px-5 py-5">
            {/* 프로필 영역 */}
            <div className="flex gap-4 mb-5">
              {/* 사진 자리 (이니셜) */}
              <div className="w-20 h-24 rounded-lg bg-gray-200 border-2 border-gray-300 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-gray-500">
                  {card.user.name?.slice(-2)}
                </span>
              </div>

              {/* 이름 + 계급 */}
              <div className="flex-1 pt-1">
                <p className="text-xl font-bold text-gray-900 tracking-wide">{card.user.name}</p>
                <p className="text-sm text-gray-600 mt-0.5">{card.user.rank}</p>
                <div className="mt-2">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isExpired
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {isExpired ? "기간 만료" : "승인됨"}
                  </span>
                </div>
              </div>
            </div>

            {/* 정보 그리드 */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <IdField label="소속 및 직책" value={`${card.user.unit || "-"} / ${card.user.position || "상비예비군"}`} full />
              <IdField label="군번" value={card.user.serviceNumber || "-"} />
              <IdField
                label="생년월일"
                value={card.user.birthDate ? formatBirthDate(card.user.birthDate) : "-"}
              />
              <IdField label="고유번호" value={card.uniqueNumber} mono />
              <IdField
                label="유효기간"
                value={`${formatDate(card.validFrom)} ~ ${formatDate(card.validUntil)}`}
              />
            </div>
          </div>

          {/* 하단 고지문 */}
          <div className="bg-gray-100 border-t border-gray-200 px-5 py-3">
            <p className="text-[11px] text-gray-500 leading-relaxed text-center">
              본 모바일 신분증은 상비예비군 소집훈련을 위한<br />
              601수송대 입/퇴영시에만 효력이 있습니다.
            </p>
          </div>

          {/* 만료 도장 오버레이 */}
          {isExpired && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-red-500/60 rounded-xl px-6 py-3 rotate-[-20deg]">
                <span className="text-red-500/60 text-3xl font-black tracking-widest">만 료</span>
              </div>
            </div>
          )}
        </div>

        {/* 카드 아래 정보 */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            승인일: {card.approvedAt ? formatDate(card.approvedAt) : "-"} |
            승인자: {card.approvedBy?.name || "-"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// 신분증 필드 컴포넌트
// ──────────────────────────────────────────────
function IdField({ label, value, full, mono }: { label: string; value: string; full?: boolean; mono?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-gray-800 font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────
// 관리자 신분증 목록 (인라인)
// ──────────────────────────────────────────────
function AdminIdCardList() {
  const [cards, setCards] = useState<
    Array<{
      id: string;
      uniqueNumber: string;
      isApproved: boolean;
      rejectedAt: string | null;
      rejectReason: string | null;
      createdAt: string;
      user: {
        name: string;
        rank: string | null;
        serviceNumber: string | null;
        unit: string | null;
        batch: { name: string } | null;
      };
      approvedBy: { name: string } | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetch("/api/mobile-id/manage")
      .then((r) => r.json())
      .then((data) => {
        setCards(data);
        setLoading(false);
      });
  }, []);

  const handleAction = async (cardId: string, action: "approve" | "reject") => {
    const res = await fetch("/api/mobile-id/manage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId, action, rejectReason: action === "reject" ? rejectReason : undefined }),
    });
    if (res.ok) {
      // 새로고침
      const data = await fetch("/api/mobile-id/manage").then((r) => r.json());
      setCards(data);
      setRejectId(null);
      setRejectReason("");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>신분증 발급 신청이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((c) => {
        const status = c.isApproved
          ? "approved"
          : c.rejectedAt
          ? "rejected"
          : "pending";

        return (
          <div key={c.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm">
                  {c.user.rank} {c.user.name}
                  <span className="text-gray-400 text-xs ml-2">{c.user.serviceNumber}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.user.batch?.name} | {c.user.unit} | {c.uniqueNumber}
                </p>
              </div>
              <div className="shrink-0">
                {status === "approved" && (
                  <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">승인됨</span>
                )}
                {status === "rejected" && (
                  <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 font-medium">반려</span>
                )}
                {status === "pending" && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleAction(c.id, "approve")}
                      className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => setRejectId(rejectId === c.id ? null : c.id)}
                      className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      반려
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 반려 사유 입력 */}
            {rejectId === c.id && (
              <div className="mt-3 flex gap-2">
                <input
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유 입력"
                  className="flex-1 px-3 py-1.5 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  onClick={() => handleAction(c.id, "reject")}
                  className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 shrink-0"
                >
                  반려 확인
                </button>
              </div>
            )}

            {/* 이미 반려된 건의 사유 표시 */}
            {status === "rejected" && c.rejectReason && (
              <p className="mt-2 text-xs text-red-600">반려 사유: {c.rejectReason}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
