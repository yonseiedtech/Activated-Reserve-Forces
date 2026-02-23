"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Script from "next/script";
import PageTitle from "@/components/ui/PageTitle";

interface Unit {
  id: string;
  name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

const NAVER_CLIENT_ID = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || "";

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", address: "", latitude: null as number | null, longitude: null as number | null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", address: "", latitude: null as number | null, longitude: null as number | null });

  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = () => fetch("/api/units").then((r) => r.json()).then(setUnits);

  const handleCreate = async () => {
    const res = await fetch("/api/units", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ name: "", description: "", address: "", latitude: null, longitude: null });
      fetchUnits();
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditForm({
      name: unit.name,
      description: unit.description || "",
      address: unit.address || "",
      latitude: unit.latitude,
      longitude: unit.longitude,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/units/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (res.ok) {
      setEditingId(null);
      fetchUnits();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("부대를 삭제하시겠습니까?")) return;
    await fetch(`/api/units/${id}`, { method: "DELETE" });
    fetchUnits();
  };

  return (
    <div>
      {NAVER_CLIENT_ID && (
        <Script
          src={`https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${NAVER_CLIENT_ID}`}
          strategy="lazyOnload"
          onLoad={() => setMapReady(true)}
        />
      )}
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />

      <PageTitle
        title="부대 관리"
        description="부대 정보를 등록/수정/삭제합니다."
        actions={
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 부대 추가
          </button>
        }
      />

      <div className="space-y-3">
        {units.map((unit) => (
          <div key={unit.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
            {editingId === unit.id ? (
              <EditUnitInline
                editForm={editForm}
                setEditForm={setEditForm}
                onSave={handleUpdate}
                onCancel={() => setEditingId(null)}
                mapReady={mapReady}
              />
            ) : (
              <>
                <div>
                  <h3 className="font-semibold">{unit.name}</h3>
                  {unit.description && <p className="text-sm text-gray-500 mt-1">{unit.description}</p>}
                  {unit.address && (
                    <p className="text-xs text-gray-400 mt-1">
                      {unit.address}
                      {unit.latitude && unit.longitude && (
                        <span className="ml-2 text-green-600">({unit.latitude.toFixed(4)}, {unit.longitude.toFixed(4)})</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleEdit(unit)} className="px-3 py-1 text-blue-600 border border-blue-200 rounded-lg text-sm hover:bg-blue-50">수정</button>
                  <button onClick={() => handleDelete(unit.id)} className="px-3 py-1 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">삭제</button>
                </div>
              </>
            )}
          </div>
        ))}
        {units.length === 0 && <p className="text-center py-8 text-gray-400">등록된 부대가 없습니다.</p>}
      </div>

      {/* 부대 추가 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold">부대 추가</h3>
            <input placeholder="부대명 (예: 00사단 00연대)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <input placeholder="설명 (선택)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />

            <UnitAddressMap
              address={form.address}
              latitude={form.latitude}
              longitude={form.longitude}
              onChange={(addr, lat, lng) => setForm({ ...form, address: addr, latitude: lat, longitude: lng })}
              mapReady={mapReady}
            />

            <div className="flex gap-3 pt-2">
              <button onClick={handleCreate} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">등록</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 인라인 편집 ──
function EditUnitInline({
  editForm,
  setEditForm,
  onSave,
  onCancel,
  mapReady,
}: {
  editForm: { name: string; description: string; address: string; latitude: number | null; longitude: number | null };
  setEditForm: React.Dispatch<React.SetStateAction<typeof editForm>>;
  onSave: () => void;
  onCancel: () => void;
  mapReady: boolean;
}) {
  return (
    <div className="flex-1 space-y-2">
      <input
        value={editForm.name}
        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder="부대명"
      />
      <input
        value={editForm.description}
        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder="설명 (선택)"
      />
      <UnitAddressMap
        address={editForm.address}
        latitude={editForm.latitude}
        longitude={editForm.longitude}
        onChange={(addr, lat, lng) => setEditForm({ ...editForm, address: addr, latitude: lat, longitude: lng })}
        mapReady={mapReady}
      />
      <div className="flex gap-2">
        <button onClick={onSave} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">저장</button>
        <button onClick={onCancel} className="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50">취소</button>
      </div>
    </div>
  );
}

// ── 주소 검색 + 네이버맵 컴포넌트 ──
function UnitAddressMap({
  address,
  latitude,
  longitude,
  onChange,
  mapReady,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (address: string, lat: number | null, lng: number | null) => void;
  mapReady: boolean;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const markerRef = useRef<unknown>(null);

  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapReady || !mapContainerRef.current) return;
    const nmaps = window.naver.maps;
    const position = new nmaps.LatLng(lat, lng);

    if (!mapRef.current) {
      const map = new nmaps.Map(mapContainerRef.current, {
        center: position,
        zoom: 16,
      });
      const marker = new nmaps.Marker({ position, map });
      mapRef.current = map;
      markerRef.current = marker;

      nmaps.Event.addListener(map, "click", (e: { coord: { lat: () => number; lng: () => number } }) => {
        const clickLat = e.coord.lat();
        const clickLng = e.coord.lng();
        marker.setPosition(new nmaps.LatLng(clickLat, clickLng));
        onChange(address, clickLat, clickLng);
      });
    } else {
      const map = mapRef.current as { setCenter: (pos: unknown) => void };
      const marker = markerRef.current as { setPosition: (pos: unknown) => void };
      map.setCenter(position);
      marker.setPosition(position);
    }
  }, [mapReady, address, onChange]);

  useEffect(() => {
    if (latitude && longitude && mapReady) {
      initMap(latitude, longitude);
    }
  }, [latitude, longitude, mapReady, initMap]);

  const handleAddressSearch = () => {
    if (typeof window === "undefined" || !window.daum) return;
    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        const addr = data.roadAddress || data.jibunAddress;
        // 서버 API로 좌표 변환 (네이버 Geocoding은 서버 키 필요)
        fetch(`/api/geocode?address=${encodeURIComponent(addr)}`)
          .then((r) => r.json())
          .then((geo) => {
            if (geo.lat && geo.lng) {
              onChange(addr, geo.lat, geo.lng);
              initMap(geo.lat, geo.lng);
            } else {
              onChange(addr, null, null);
            }
          })
          .catch(() => onChange(addr, null, null));
      },
    }).open();
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">부대 위치</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          readOnly
          placeholder="주소를 검색하세요"
          className="flex-1 px-3 py-2 text-sm border rounded-lg bg-gray-50 outline-none"
        />
        <button
          type="button"
          onClick={handleAddressSearch}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border shrink-0"
        >
          주소 검색
        </button>
      </div>
      {latitude && longitude && (
        <p className="text-xs text-gray-500">좌표: {latitude.toFixed(6)}, {longitude.toFixed(6)}</p>
      )}
      {mapReady && (
        <div
          ref={mapContainerRef}
          className="w-full h-48 rounded-lg border bg-gray-100"
          style={{ display: latitude && longitude ? "block" : "none" }}
        />
      )}
      {!mapReady && NAVER_CLIENT_ID && (
        <p className="text-xs text-gray-400">네이버 지도를 불러오는 중...</p>
      )}
      {!NAVER_CLIENT_ID && (
        <p className="text-xs text-orange-500">네이버 지도 API 키가 설정되지 않았습니다.</p>
      )}
    </div>
  );
}
