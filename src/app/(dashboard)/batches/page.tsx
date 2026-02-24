"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";
import { BATCH_STATUS_LABELS } from "@/lib/constants";

interface Batch {
  id: string;
  name: string;
  year: number;
  number: number;
  startDate: string;
  endDate: string;
  status: string;
  location: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  PLANNED: "bg-yellow-100 text-yellow-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
};

export default function ReservistBatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => r.json())
      .then(setBatches)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageTitle title="차수현황" />

      {batches.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          배정된 훈련차수가 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/batches/${b.id}`}
              className="block bg-white rounded-xl border p-4 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{b.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {b.startDate.split("T")[0] === b.endDate.split("T")[0]
                      ? new Date(b.startDate).toLocaleDateString("ko-KR")
                      : `${new Date(b.startDate).toLocaleDateString("ko-KR")} ~ ${new Date(b.endDate).toLocaleDateString("ko-KR")}`
                    }
                    {b.location && ` | ${b.location}`}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                  {BATCH_STATUS_LABELS[b.status] || b.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
