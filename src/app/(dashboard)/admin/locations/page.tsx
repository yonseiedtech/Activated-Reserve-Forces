"use client";

import { useEffect, useState } from "react";
import PageTitle from "@/components/ui/PageTitle";

interface GpsLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
}

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<GpsLocation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", latitude: 0, longitude: 0, radius: 200 });
  const [detectingGps, setDetectingGps] = useState(false);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = () => fetch("/api/gps-locations").then((r) => r.json()).then(setLocations);

  const handleDetectGps = () => {
    setDetectingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setDetectingGps(false);
      },
      () => setDetectingGps(false),
      { enableHighAccuracy: true }
    );
  };

  const handleCreate = async () => {
    const res = await fetch("/api/gps-locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setShowForm(false); fetchLocations(); }
  };

  const handleToggle = async (loc: GpsLocation) => {
    await fetch(`/api/gps-locations/${loc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...loc, isActive: !loc.isActive }),
    });
    fetchLocations();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("위치를 삭제하시겠습니까?")) return;
    await fetch(`/api/gps-locations/${id}`, { method: "DELETE" });
    fetchLocations();
  };

  return (
    <div>
      <PageTitle
        title="GPS 위치 관리"
        description="출퇴근 기준 위치(위병소/훈련장)를 등록합니다."
        actions={
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 위치 등록
          </button>
        }
      />

      <div className="space-y-3">
        {locations.map((loc) => (
          <div key={loc.id} className="bg-white rounded-xl border p-4 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${loc.isActive ? "bg-green-500" : "bg-gray-400"}`} />
                <h3 className="font-semibold">{loc.name}</h3>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                위도: {loc.latitude.toFixed(6)} | 경도: {loc.longitude.toFixed(6)} | 반경: {loc.radius}m
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleToggle(loc)}
                className={`px-3 py-1 text-sm rounded-lg ${loc.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
              >
                {loc.isActive ? "활성" : "비활성"}
              </button>
              <button onClick={() => handleDelete(loc.id)} className="px-3 py-1 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-50">삭제</button>
            </div>
          </div>
        ))}
        {locations.length === 0 && <p className="text-center py-8 text-gray-400">등록된 위치가 없습니다.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">GPS 위치 등록</h3>
            <input placeholder="위치명 (예: 00사단 위병소)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">위도</label>
                <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
              <div>
                <label className="text-sm font-medium">경도</label>
                <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
              </div>
            </div>
            <button onClick={handleDetectGps} disabled={detectingGps} className="w-full py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-50">
              {detectingGps ? "위치 확인 중..." : "현재 위치로 설정"}
            </button>
            <div>
              <label className="text-sm font-medium">허용 반경 (미터)</label>
              <input type="number" value={form.radius} onChange={(e) => setForm({ ...form, radius: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg" />
            </div>
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
