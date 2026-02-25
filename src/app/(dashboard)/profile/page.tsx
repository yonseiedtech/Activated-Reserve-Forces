"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import Script from "next/script";
import Image from "next/image";
import PageTitle from "@/components/ui/PageTitle";
import { ROLE_LABELS } from "@/lib/constants";
import { formatPhone } from "@/lib/formatters";

interface ProfileData {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: string;
  phone: string | null;
  rank: string | null;
  serviceNumber: string | null;
  unit: string | null;
  position: string | null;
  birthDate: string | null;
  branch: string | null;
  warBattalion: string | null;
  warCompany: string | null;
  warPlatoon: string | null;
  warPosition: string | null;
  photoUrl: string | null;
  pendingPhotoUrl: string | null;
  photoRejectedAt: string | null;
  photoRejectReason: string | null;
  zipCode: string | null;
  address: string | null;
  addressDetail: string | null;
  pendingZipCode: string | null;
  pendingAddress: string | null;
  pendingAddressDetail: string | null;
  addressRejectedAt: string | null;
  addressRejectReason: string | null;
  noVehicle: boolean;
  vehicleType: string | null;
  vehiclePlateNumber: string | null;
  vehicleColor: string | null;
  bankName: string | null;
  bankAccount: string | null;
  batches: string[];
}

interface TransportResult {
  distance_m: number;
  km: number;
  hasToll: boolean;
  tollFare: number;
  total: number;
  fuel: number;
  toll: number;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  routeCoords: Array<{ lat: number; lng: number }>;
}

type Tab = "basic" | "contact" | "vehicle" | "bankAccount" | "password";

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("basic");

  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [address, setAddress] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [noVehicle, setNoVehicle] = useState(false);
  const [vehicleType, setVehicleType] = useState("");
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [transport, setTransport] = useState<TransportResult | null>(null);
  const [transportLoading, setTransportLoading] = useState(false);
  const [transportError, setTransportError] = useState("");

  const [mapReady, setMapReady] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data: ProfileData = await res.json();
        setProfile(data);
        setPhone(data.phone || "");
        setZipCode(data.zipCode || "");
        setAddress(data.address || "");
        setAddressDetail(data.addressDetail || "");
        setNoVehicle(data.noVehicle || false);
        setVehicleType(data.vehicleType || "");
        setVehiclePlateNumber(data.vehiclePlateNumber || "");
        setVehicleColor(data.vehicleColor || "");
        setBankName(data.bankName || "");
        setBankAccount(data.bankAccount || "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchTransport = useCallback(async (addr: string, unitName: string) => {
    if (!addr || !unitName) return;
    setTransportLoading(true);
    setTransportError("");
    try {
      const res = await fetch(`/api/transport-calc?address=${encodeURIComponent(addr)}&unitName=${encodeURIComponent(unitName)}`);
      const data = await res.json();
      if (res.ok) {
        setTransport(data);
      } else {
        setTransportError(data.error || "교통비 계산 실패");
        setTransport(null);
      }
    } catch {
      setTransportError("교통비 계산 중 오류가 발생했습니다.");
      setTransport(null);
    } finally {
      setTransportLoading(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.address && profile?.unit) {
      fetchTransport(profile.address, profile.unit);
    }
  }, [profile?.address, profile?.unit, fetchTransport]);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
      if (res.ok) {
        showMessage("success", "사진이 업로드되었습니다. 관리자 승인을 기다려주세요.");
        await fetchProfile();
      } else {
        const err = await res.json();
        showMessage("error", err.error || "사진 업로드 실패");
      }
    } catch {
      showMessage("error", "사진 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveContact = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, zipCode, address, addressDetail }),
      });
      if (res.ok) {
        const isAddressChanged = zipCode !== (profile?.zipCode || "") ||
          address !== (profile?.address || "") ||
          addressDetail !== (profile?.addressDetail || "");
        if (isAddressChanged && session?.user?.role === "RESERVIST") {
          showMessage("success", "주소 변경이 요청되었습니다. 관리자 승인을 기다려주세요.");
        } else {
          showMessage("success", "저장되었습니다.");
        }
        await fetchProfile();
      } else {
        const err = await res.json();
        showMessage("error", err.error || "저장 실패");
      }
    } catch {
      showMessage("error", "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveVehicle = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noVehicle, vehicleType: noVehicle ? null : vehicleType, vehiclePlateNumber: noVehicle ? null : vehiclePlateNumber, vehicleColor: noVehicle ? null : vehicleColor }),
      });
      if (res.ok) {
        showMessage("success", "차량 정보가 저장되었습니다.");
        await fetchProfile();
      } else {
        const err = await res.json();
        showMessage("error", err.error || "저장 실패");
      }
    } catch {
      showMessage("error", "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBankAccount = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, bankAccount }),
      });
      if (res.ok) {
        showMessage("success", "계좌 정보가 저장되었습니다.");
        await fetchProfile();
      } else {
        const err = await res.json();
        showMessage("error", err.error || "저장 실패");
      }
    } catch {
      showMessage("error", "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "새 비밀번호는 6자 이상이어야 합니다." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPwMessage({ type: "success", text: "비밀번호가 변경되었습니다." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const err = await res.json();
        setPwMessage({ type: "error", text: err.error || "비밀번호 변경 실패" });
      }
    } catch {
      setPwMessage({ type: "error", text: "비밀번호 변경 중 오류가 발생했습니다." });
    } finally {
      setPwSaving(false);
    }
  };

  const handleAddressSearch = () => {
    if (typeof window === "undefined" || !window.daum) return;
    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        setZipCode(data.zonecode);
        setAddress(data.roadAddress || data.jibunAddress);
      },
    }).open();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!profile) return null;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("ko-KR");

  const hasApprovedPhoto = !!profile.photoUrl;
  const hasPendingPhoto = !!profile.pendingPhotoUrl;
  const wasRejected = !!profile.photoRejectedAt;
  const hasPendingAddress = !!profile.pendingAddress;
  const addressWasRejected = !!profile.addressRejectedAt;

  const tabs: { key: Tab; label: string }[] = [
    { key: "basic", label: "기본 정보" },
    { key: "contact", label: "연락처/주소" },
    { key: "vehicle", label: "차량 정보" },
    { key: "bankAccount", label: "보상금 계좌" },
    { key: "password", label: "비밀번호" },
  ];

  return (
    <div className="max-w-lg">
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        strategy="lazyOnload"
        onLoad={() => { if (window.L) setMapReady(true); }}
      />
      <PageTitle title="내 정보" />

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        {/* ── 헤더 ── */}
        <div className="bg-blue-600 px-6 py-8 text-white">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/30 bg-white/20 flex items-center justify-center group relative cursor-pointer"
              >
                {hasApprovedPhoto ? (
                  <Image src={profile.photoUrl!} alt="프로필 사진" width={96} height={96} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl font-bold text-white/80">{profile.name.slice(-2)}</span>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </button>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                </div>
              )}
              {hasPendingPhoto && (
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full">대기</span>
              )}
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload} />
            </div>
            <div>
              <h2 className="text-xl font-bold">{profile.rank ? `${profile.rank} ` : ""}{profile.name}</h2>
              <p className="text-blue-100 text-sm mt-0.5">{ROLE_LABELS[profile.role] || profile.role}</p>
              {hasPendingPhoto && <p className="text-yellow-200 text-xs mt-1">사진 승인 대기 중</p>}
              {wasRejected && !hasPendingPhoto && <p className="text-red-200 text-xs mt-1">사진 반려: {profile.photoRejectReason}</p>}
            </div>
          </div>
        </div>

        {/* ── 탭 ── */}
        <div className="flex border-b bg-gray-50">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                activeTab === tab.key ? "text-blue-600 border-b-2 border-blue-600 bg-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 기본 정보 */}
        {activeTab === "basic" && (
          <div>
            <SectionHeader title="인적 사항" />
            <div className="divide-y">
              <InfoRow label="이름" value={profile.name} />
              <InfoRow label="계급" value={profile.rank} />
              <InfoRow label="군번" value={profile.serviceNumber} />
              <InfoRow label="소속부대" value={profile.unit} />
              <InfoRow label="생년월일" value={profile.birthDate ? formatDate(profile.birthDate) : null} />
              <InfoRow label="병과" value={profile.branch} />
              <InfoRow label="소속 차수" value={profile.batches.join(", ") || null} />
            </div>
            <SectionHeader title="전시편성" />
            <div className="divide-y">
              <InfoRow label="전시부대(대대)" value={profile.warBattalion} />
              <InfoRow label="전시부대(중대)" value={profile.warCompany} />
              <InfoRow label="전시부대(소대)" value={profile.warPlatoon} />
              <InfoRow label="전시직책" value={profile.warPosition} />
            </div>
          </div>
        )}

        {/* 연락처/주소 */}
        {activeTab === "contact" && (
          <div>
            <SectionHeader title="연락처 정보" editable />
            <div className="px-6 py-3 space-y-3">
              <InputField label="연락처" value={phone} onChange={(v) => setPhone(formatPhone(v))} placeholder="01012345678" />
              <div>
                <label className="block text-sm text-gray-500 mb-1">주소</label>
                {hasPendingAddress && (
                  <div className="mb-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    <p className="font-medium text-yellow-800">주소 변경 승인 대기 중</p>
                    <p className="text-yellow-700 text-xs mt-1">변경 요청: [{profile.pendingZipCode}] {profile.pendingAddress} {profile.pendingAddressDetail}</p>
                  </div>
                )}
                {addressWasRejected && !hasPendingAddress && (
                  <div className="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm">
                    <p className="font-medium text-red-800">주소 변경 반려</p>
                    <p className="text-red-700 text-xs mt-1">사유: {profile.addressRejectReason}</p>
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  <input type="text" value={zipCode} readOnly placeholder="우편번호" className="w-28 px-3 py-2 text-sm border rounded-lg bg-gray-50 outline-none" />
                  <button type="button" onClick={handleAddressSearch} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors border shrink-0">우편번호 검색</button>
                </div>
                <input type="text" value={address} readOnly placeholder="기본 주소" className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-50 outline-none mb-2" />
                <input type="text" value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="상세 주소 입력" className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <TransportInfoCard
              transport={transport}
              transportLoading={transportLoading}
              transportError={transportError}
              mapReady={mapReady}
              address={profile.address}
              unit={profile.unit}
            />

            <div className="px-6 py-4 bg-gray-50 border-t">
              <button onClick={handleSaveContact} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "저장 중..." : "연락처/주소 저장"}
              </button>
            </div>
          </div>
        )}

        {/* 차량 정보 */}
        {activeTab === "vehicle" && (
          <div>
            <SectionHeader title="차량 정보" editable />
            <div className="px-6 py-3 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noVehicle}
                  onChange={(e) => setNoVehicle(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">차량 미보유</span>
              </label>
              {!noVehicle && (
                <>
                  <InputField label="차량 종류" value={vehicleType} onChange={setVehicleType} placeholder="예: 승용차, SUV" />
                  <InputField label="차량 번호" value={vehiclePlateNumber} onChange={setVehiclePlateNumber} placeholder="예: 12가 3456" />
                  <InputField label="차량 색상" value={vehicleColor} onChange={setVehicleColor} placeholder="예: 흰색" />
                </>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t">
              <button onClick={handleSaveVehicle} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "저장 중..." : "차량 정보 저장"}
              </button>
            </div>
          </div>
        )}

        {/* 보상금 계좌 */}
        {activeTab === "bankAccount" && (
          <div>
            <SectionHeader title="보상금 계좌 정보" editable />
            <div className="px-6 py-3 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                <p>- 보상금은 <strong>본인 명의 계좌</strong>로만 지급 가능합니다.</p>
                <p>- 계좌번호 오류 시 입금이 불가하오니 정확히 기재해주세요.</p>
              </div>
              <div>
                <label className="block text-sm text-gray-500 mb-1">은행</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">은행 선택</option>
                  {["국민은행", "신한은행", "우리은행", "하나은행", "농협은행", "기업은행", "카카오뱅크", "토스뱅크", "SC제일은행", "대구은행", "부산은행", "경남은행", "광주은행", "전북은행", "제주은행", "수협은행", "우체국", "새마을금고", "신협", "산업은행"].map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <InputField label="계좌번호" value={bankAccount} onChange={setBankAccount} placeholder="계좌번호를 입력하세요 (- 없이)" />
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t">
              <button onClick={handleSaveBankAccount} disabled={saving} className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? "저장 중..." : "계좌 정보 저장"}
              </button>
            </div>
          </div>
        )}

        {/* 비밀번호 */}
        {activeTab === "password" && (
          <div>
            <SectionHeader title="비밀번호 변경" editable />
            <div className="px-6 py-3 space-y-3">
              {pwMessage && (
                <div className={`px-3 py-2 rounded-lg text-sm ${pwMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                  {pwMessage.text}
                </div>
              )}
              <InputField label="현재 비밀번호" value={currentPassword} onChange={setCurrentPassword} type="password" />
              <InputField label="새 비밀번호" value={newPassword} onChange={setNewPassword} type="password" placeholder="6자 이상" />
              <div>
                <label className="block text-sm text-gray-500 mb-1">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 ${confirmPassword && newPassword !== confirmPassword ? "border-red-300" : ""}`}
                />
                {confirmPassword && newPassword !== confirmPassword && <p className="text-xs text-red-500 mt-1">비밀번호가 일치하지 않습니다.</p>}
              </div>
              <button
                onClick={handleChangePassword}
                disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
                className="w-full py-2.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
              >
                {pwSaving ? "변경 중..." : "비밀번호 변경"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 교통비 정보 카드 (네이버맵 경로) ──
function TransportInfoCard({
  transport,
  transportLoading,
  transportError,
  mapReady,
  address,
  unit,
}: {
  transport: TransportResult | null;
  transportLoading: boolean;
  transportError: string;
  mapReady: boolean;
  address: string | null;
  unit: string | null;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    if (!transport || !mapReady || !mapContainerRef.current || !window.L) return;
    if (transport.routeCoords.length === 0) return;

    // Cleanup previous map
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const L = window.L;
    const center: [number, number] = [
      (transport.origin.lat + transport.destination.lat) / 2,
      (transport.origin.lng + transport.destination.lng) / 2,
    ];
    const map = L.map(mapContainerRef.current).setView(center, 10);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // 출발지 마커
    L.marker([transport.origin.lat, transport.origin.lng]).addTo(map);

    // 도착지 마커
    L.marker([transport.destination.lat, transport.destination.lng]).addTo(map);

    // 경로 폴리라인
    const path: [number, number][] = transport.routeCoords.map((c) => [c.lat, c.lng]);
    const polyline = L.polyline(path, {
      color: "#3B82F6",
      weight: 4,
      opacity: 0.8,
    }).addTo(map);

    // bounds 설정
    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [transport, mapReady]);

  if (!address || !unit) return null;

  return (
    <div className="border-t">
      <div className="px-6 py-2.5 bg-gray-50 border-b flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">교통비 정보</h3>
      </div>
      <div className="px-6 py-4">
        {transportLoading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            교통비 계산 중...
          </div>
        )}
        {transportError && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <p className="text-sm text-orange-700 font-medium">{transportError}</p>
            <p className="text-xs text-orange-500 mt-1">프로필의 주소를 도로명 주소(예: 서울시 용산구 이태원로 22)로 수정하면 해결될 수 있습니다.</p>
          </div>
        )}
        {transport && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-blue-600 font-medium">이동거리</p>
                <p className="text-lg font-bold text-blue-900">{transport.km} km</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-green-600 font-medium">교통비</p>
                <p className="text-lg font-bold text-green-900">{transport.total.toLocaleString()}원</p>
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>유료도로: {transport.hasToll ? `포함 (${transport.tollFare.toLocaleString()}원)` : "미포함"}</p>
              {transport.km > 30 && <p>연료비: {transport.fuel.toLocaleString()}원 / 통행료 환산: {transport.toll.toLocaleString()}원</p>}
              {transport.km <= 30 && <p>30km 이하 기본 교통비 적용</p>}
            </div>

            {mapReady && transport.routeCoords.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">계산 경로</p>
                <div ref={mapContainerRef} className="w-full h-48 rounded-lg border" />
              </div>
            )}
          </div>
        )}
        {!transportLoading && !transportError && !transport && (
          <p className="text-sm text-gray-400">부대에 좌표가 등록되면 교통비가 자동 계산됩니다.</p>
        )}
      </div>
    </div>
  );
}

// ── 하위 컴포넌트 ──
function SectionHeader({ title, editable }: { title: string; editable?: boolean }) {
  return (
    <div className="px-6 py-2.5 bg-gray-50 border-t border-b flex items-center justify-between">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      {editable && <span className="text-[10px] text-blue-500 font-medium">수정 가능</span>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center px-6 py-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || "-"}</span>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-sm text-gray-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
}
