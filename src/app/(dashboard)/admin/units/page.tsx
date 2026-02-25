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

interface GpsLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
}

export default function AdminUnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", address: "", latitude: null as number | null, longitude: null as number | null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", address: "", latitude: null as number | null, longitude: null as number | null });

  const [mapReady, setMapReady] = useState(false);

  // GPS 위치 관리 (부대 카드 내 통합)
  const [gpsLocations, setGpsLocations] = useState<GpsLocation[]>([]);
  const [expandedUnitGps, setExpandedUnitGps] = useState<string | null>(null);
  const [showGpsForm, setShowGpsForm] = useState(false);
  const [gpsForm, setGpsForm] = useState({ name: "", latitude: 0, longitude: 0, radius: 200 });
  const [detectingGps, setDetectingGps] = useState(false);
  const [editingGpsId, setEditingGpsId] = useState<string | null>(null);
  const [editGpsForm, setEditGpsForm] = useState({ name: "", latitude: 0, longitude: 0, radius: 200 });

  useEffect(() => {
    fetchUnits();
    fetchGpsLocations();
  }, []);

  const fetchUnits = () => fetch("/api/units").then((r) => r.json()).then(setUnits);
  const fetchGpsLocations = () => fetch("/api/gps-locations").then((r) => r.json()).then(setGpsLocations);

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

  // GPS 위치 핸들러
  const handleDetectGps = (target: "new" | "edit") => {
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (target === "edit") {
          setEditGpsForm((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        } else {
          setGpsForm((prev) => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        }
        setDetectingGps(false);
      },
      () => setDetectingGps(false),
      { enableHighAccuracy: true }
    );
  };

  const handleCreateGps = async () => {
    const res = await fetch("/api/gps-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gpsForm),
    });
    if (res.ok) {
      setShowGpsForm(false);
      setGpsForm({ name: "", latitude: 0, longitude: 0, radius: 200 });
      fetchGpsLocations();
    }
  };

  const handleEditGps = (loc: GpsLocation) => {
    setEditingGpsId(loc.id);
    setEditGpsForm({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude, radius: loc.radius });
  };

  const handleUpdateGps = async () => {
    if (!editingGpsId) return;
    await fetch(`/api/gps-locations/${editingGpsId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editGpsForm),
    });
    setEditingGpsId(null);
    fetchGpsLocations();
  };

  const handleToggleGps = async (loc: GpsLocation) => {
    await fetch(`/api/gps-locations/${loc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...loc, isActive: !loc.isActive }),
    });
    fetchGpsLocations();
  };

  const handleDeleteGps = async (id: string) => {
    if (!confirm("GPS 위치를 삭제하시겠습니까?")) return;
    await fetch(`/api/gps-locations/${id}`, { method: "DELETE" });
    fetchGpsLocations();
  };

  return (
    <div>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        strategy="lazyOnload"
        onLoad={() => {
          if (window.L) setMapReady(true);
        }}
      />
      <Script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js" strategy="lazyOnload" />

      <PageTitle
        title="부대 관리"
        description="부대 정보 및 GPS 출퇴근 위치를 관리합니다."
        actions={
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 부대 추가
          </button>
        }
      />

      {/* 부대 목록 */}
      <div className="space-y-3">
        {units.map((unit) => (
          <div key={unit.id} className="bg-white rounded-xl border">
            <div className="p-4">
              {editingId === unit.id ? (
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
                    <button onClick={handleUpdate} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">저장</button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-1 border rounded text-sm text-gray-600 hover:bg-gray-50">취소</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
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
                    {!unit.latitude && !unit.longitude && (
                      <p className="text-xs text-orange-500 mt-1">좌표 미등록 (교통비 계산 불가)</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleEdit(unit)} className="px-3 py-1 text-blue-600 border border-blue-200 rounded-lg text-sm hover:bg-blue-50">수정</button>
                    <button onClick={() => handleDelete(unit.id)} className="px-3 py-1 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">삭제</button>
                  </div>
                </div>
              )}
            </div>

            {/* GPS 출퇴근 위치 (부대 카드 내 통합) */}
            <div className="border-t">
              <button
                onClick={() => setExpandedUnitGps(expandedUnitGps === unit.id ? null : unit.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm text-gray-600 hover:bg-gray-50"
              >
                <span className="font-medium">출퇴근 GPS 위치 ({gpsLocations.length})</span>
                <svg
                  className={`w-4 h-4 transition-transform ${expandedUnitGps === unit.id ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {expandedUnitGps === unit.id && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-gray-500">출퇴근 확인에 사용되는 기준 위치(위병소, 훈련장 등)를 등록합니다.</p>

                  {gpsLocations.map((loc) => (
                    <div key={loc.id} className="bg-gray-50 rounded-lg p-3">
                      {editingGpsId === loc.id ? (
                        <GpsLocationForm
                          form={editGpsForm}
                          setForm={setEditGpsForm}
                          onSave={handleUpdateGps}
                          onCancel={() => setEditingGpsId(null)}
                          onDetect={() => handleDetectGps("edit")}
                          detecting={detectingGps}
                          mapReady={mapReady}
                          saveLabel="저장"
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${loc.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                              <span className="font-medium text-sm truncate">{loc.name}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 ml-4">
                              ({loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}) · 반경 {loc.radius}m
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleToggleGps(loc)}
                              className={`px-2 py-0.5 text-xs rounded ${loc.isActive ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}
                            >
                              {loc.isActive ? "활성" : "비활성"}
                            </button>
                            <button onClick={() => handleEditGps(loc)} className="px-2 py-0.5 text-xs text-blue-600 border border-blue-200 rounded hover:bg-blue-50">수정</button>
                            <button onClick={() => handleDeleteGps(loc.id)} className="px-2 py-0.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">삭제</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {gpsLocations.length === 0 && !showGpsForm && (
                    <p className="text-center py-4 text-xs text-gray-400">등록된 GPS 위치가 없습니다.</p>
                  )}

                  {showGpsForm ? (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <GpsLocationForm
                        form={gpsForm}
                        setForm={setGpsForm}
                        onSave={handleCreateGps}
                        onCancel={() => setShowGpsForm(false)}
                        onDetect={() => handleDetectGps("new")}
                        detecting={detectingGps}
                        mapReady={mapReady}
                        saveLabel="등록"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowGpsForm(true)}
                      className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-400"
                    >
                      + GPS 위치 추가
                    </button>
                  )}
                </div>
              )}
            </div>
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

// ── GPS 위치 폼 (Leaflet 지도 포함) ──
function GpsLocationForm({
  form,
  setForm,
  onSave,
  onCancel,
  onDetect,
  detecting,
  mapReady,
  saveLabel,
}: {
  form: { name: string; latitude: number; longitude: number; radius: number };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  onSave: () => void;
  onCancel: () => void;
  onDetect: () => void;
  detecting: boolean;
  mapReady: boolean;
  saveLabel: string;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const updateMapMarker = useCallback((lat: number, lng: number, radius: number) => {
    if (!mapReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([lat, lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      const circle = L.circle([lat, lng], {
        radius,
        color: "#3B82F6",
        weight: 2,
        opacity: 0.6,
        fillColor: "#3B82F6",
        fillOpacity: 0.15,
      }).addTo(map);

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        marker.setLatLng([clickLat, clickLng]);
        circle.setLatLng([clickLat, clickLng]);
        setForm((prev) => ({ ...prev, latitude: clickLat, longitude: clickLng }));
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        circle.setLatLng([pos.lat, pos.lng]);
        setForm((prev) => ({ ...prev, latitude: pos.lat, longitude: pos.lng }));
      });
    } else {
      mapRef.current.setView([lat, lng], 16);
      markerRef.current?.setLatLng([lat, lng]);
      circleRef.current?.setLatLng([lat, lng]);
      circleRef.current?.setRadius(radius);
    }
  }, [mapReady, setForm]);

  useEffect(() => {
    if (form.latitude && form.longitude && mapReady) {
      updateMapMarker(form.latitude, form.longitude, form.radius);
    }
  }, [form.latitude, form.longitude, form.radius, mapReady, updateMapMarker]);

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(form.radius);
    }
  }, [form.radius]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
      }
    };
  }, []);

  const hasCoords = form.latitude !== 0 && form.longitude !== 0;

  return (
    <div className="space-y-3">
      <input
        value={form.name}
        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        className="w-full px-3 py-2 border rounded-lg text-sm"
        placeholder="위치명 (예: 00사단 위병소)"
      />

      {/* 지도 영역 */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">위치 설정</label>
        <p className="text-xs text-gray-500 mb-2">지도를 클릭하거나 마커를 드래그하여 위치를 설정하세요.</p>

        {mapReady ? (
          <div
            ref={mapContainerRef}
            className="w-full h-48 rounded-lg border bg-gray-100"
            style={{ display: hasCoords ? "block" : "none" }}
          />
        ) : (
          <div className="w-full h-48 rounded-lg border bg-gray-100 flex items-center justify-center">
            <p className="text-sm text-gray-400">지도를 불러오는 중...</p>
          </div>
        )}

        {!hasCoords && mapReady && (
          <div className="w-full h-48 rounded-lg border bg-gray-50 flex items-center justify-center">
            <p className="text-sm text-gray-400">아래 버튼으로 위치를 먼저 설정하세요</p>
          </div>
        )}
      </div>

      {/* 위치 설정 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={onDetect}
          disabled={detecting}
          className="flex-1 py-1.5 border border-blue-300 text-blue-600 rounded-lg text-xs hover:bg-blue-50 disabled:opacity-50"
        >
          {detecting ? "위치 확인 중..." : "현재 위치로 설정"}
        </button>
        {!hasCoords && (
          <button
            onClick={() => setForm((prev) => ({ ...prev, latitude: 37.5665, longitude: 126.978 }))}
            className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs hover:bg-gray-50"
          >
            지도에서 직접 선택
          </button>
        )}
      </div>

      {/* 좌표/반경 표시 */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600">위도</label>
          <input
            type="number"
            step="any"
            value={form.latitude || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
            className="w-full px-2 py-1.5 border rounded-lg text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">경도</label>
          <input
            type="number"
            step="any"
            value={form.longitude || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
            className="w-full px-2 py-1.5 border rounded-lg text-xs"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600">반경 (m)</label>
          <input
            type="number"
            value={form.radius}
            onChange={(e) => setForm((prev) => ({ ...prev, radius: parseInt(e.target.value) || 200 }))}
            className="w-full px-2 py-1.5 border rounded-lg text-xs"
          />
        </div>
      </div>

      {hasCoords && (
        <p className="text-xs text-green-600">선택된 위치: {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onSave} className="flex-1 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm">{saveLabel}</button>
        <button onClick={onCancel} className="flex-1 py-1.5 border rounded-lg text-gray-700 hover:bg-gray-50 text-sm">취소</button>
      </div>
    </div>
  );
}

// ── 주소 검색 + Leaflet 지도 컴포넌트 ──
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
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const addressRef = useRef(address);
  addressRef.current = address;

  const initMap = useCallback((lat: number, lng: number) => {
    if (!mapReady || !mapContainerRef.current || !window.L) return;
    const L = window.L;

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([lat, lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      mapRef.current = map;
      markerRef.current = marker;

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const clickLat = e.latlng.lat;
        const clickLng = e.latlng.lng;
        marker.setLatLng([clickLat, clickLng]);
        onChange(addressRef.current, clickLat, clickLng);
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChange(addressRef.current, pos.lat, pos.lng);
      });
    } else {
      mapRef.current.setView([lat, lng], 16);
      markerRef.current?.setLatLng([lat, lng]);
    }
  }, [mapReady, onChange]);

  useEffect(() => {
    if (latitude && longitude && mapReady) {
      initMap(latitude, longitude);
    }
  }, [latitude, longitude, mapReady, initMap]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  const handleAddressSearch = () => {
    if (typeof window === "undefined" || !window.daum) return;
    new window.daum.Postcode({
      oncomplete(data: DaumPostcodeData) {
        const addr = data.roadAddress || data.jibunAddress;
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
        <p className="text-xs text-green-600">좌표: {latitude.toFixed(6)}, {longitude.toFixed(6)} (지도 클릭 또는 마커 드래그로 수정 가능)</p>
      )}
      {mapReady && (
        <div>
          {!(latitude && longitude) && (
            <p className="text-xs text-gray-500 mb-1">주소를 검색하면 지도에 표시됩니다. 이후 지도 클릭/마커 드래그로 위치를 조정하세요.</p>
          )}
          <div
            ref={mapContainerRef}
            className="w-full h-48 rounded-lg border bg-gray-100"
            style={{ display: latitude && longitude ? "block" : "none" }}
          />
        </div>
      )}
      {!mapReady && (
        <p className="text-xs text-gray-400">지도를 불러오는 중...</p>
      )}
    </div>
  );
}
