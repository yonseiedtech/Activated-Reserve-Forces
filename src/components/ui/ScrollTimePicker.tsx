"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;
const CENTER = Math.floor(VISIBLE_ITEMS / 2);

interface WheelColumnProps {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
}

function WheelColumn({ items, value, onChange, suffix = "" }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const selectedIdx = items.indexOf(value);
  const idx = selectedIdx >= 0 ? selectedIdx : 0;

  // 스크롤 위치를 선택된 인덱스에 맞춤
  const scrollToIdx = useCallback((i: number, smooth = false) => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: i * ITEM_HEIGHT,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useEffect(() => {
    scrollToIdx(idx);
  }, [idx, scrollToIdx]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    clearTimeout(timerRef.current);
    isScrollingRef.current = true;

    timerRef.current = setTimeout(() => {
      if (!containerRef.current) return;
      const scrollTop = containerRef.current.scrollTop;
      const newIdx = Math.round(scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(newIdx, items.length - 1));

      scrollToIdx(clamped, true);
      isScrollingRef.current = false;

      if (clamped !== idx) {
        onChange(items[clamped]);
      }
    }, 80);
  };

  return (
    <div className="relative" style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}>
      {/* 선택 영역 하이라이트 */}
      <div
        className="absolute left-0 right-0 bg-blue-50 border-y border-blue-200 pointer-events-none z-10"
        style={{ top: CENTER * ITEM_HEIGHT, height: ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto scrollbar-hide snap-y snap-mandatory"
        style={{
          paddingTop: CENTER * ITEM_HEIGHT,
          paddingBottom: CENTER * ITEM_HEIGHT,
        }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className={`flex items-center justify-center snap-center cursor-pointer select-none transition-all ${
              i === idx ? "text-blue-700 font-bold text-lg" : "text-gray-400 text-sm"
            }`}
            style={{ height: ITEM_HEIGHT }}
            onClick={() => {
              onChange(item);
              scrollToIdx(i, true);
            }}
          >
            {item}{suffix}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ScrollTimePickerProps {
  value: string; // "HH:mm" or ""
  onChange: (time: string) => void;
  onClose: () => void;
  title?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

export default function ScrollTimePicker({ value, onChange, onClose, title }: ScrollTimePickerProps) {
  const [h, setH] = useState(value ? value.split(":")[0] : String(new Date().getHours()).padStart(2, "0"));
  const [m, setM] = useState(value ? value.split(":")[1] : String(new Date().getMinutes()).padStart(2, "0"));

  const handleConfirm = () => {
    onChange(`${h}:${m}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:w-80 sm:rounded-xl rounded-t-2xl shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <button onClick={onClose} className="text-sm text-gray-500">취소</button>
          <span className="text-sm font-semibold text-gray-800">{title || "시간 선택"}</span>
          <button onClick={handleConfirm} className="text-sm font-semibold text-blue-600">확인</button>
        </div>

        {/* 휠 */}
        <div className="flex items-center justify-center gap-1 px-6 py-2">
          <div className="w-20">
            <WheelColumn items={HOURS} value={h} onChange={setH} suffix="시" />
          </div>
          <span className="text-xl font-bold text-gray-400 pb-1">:</span>
          <div className="w-20">
            <WheelColumn items={MINUTES} value={m} onChange={setM} suffix="분" />
          </div>
        </div>

        {/* 현재 선택 표시 */}
        <div className="text-center pb-4">
          <span className="text-2xl font-bold text-gray-900">{h}:{m}</span>
        </div>

        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
