import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import PageTitle from "@/components/ui/PageTitle";

interface Props {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ batchId?: string }>;
}

export default async function DailySchedulePage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { date } = await params;
  const { batchId: qsBatchId } = await searchParams;

  // RESERVIST는 자동으로 자기 차수 필터
  let batchId = qsBatchId;
  if (session.user.role === "RESERVIST") {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    batchId = user?.batchId || undefined;
  }

  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(date + "T23:59:59");

  const trainings = await prisma.training.findMany({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      ...(batchId ? { batchId } : {}),
    },
    orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
    include: {
      batch: { select: { name: true } },
      instructor: { select: { name: true } },
    },
  });

  const d = new Date(date + "T00:00:00");
  const headerStr = d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  // 타임라인 시간 범위 계산
  const allTimes = trainings.flatMap((t) => [t.startTime, t.endTime].filter(Boolean)) as string[];
  const minHour = allTimes.length > 0
    ? Math.min(...allTimes.map((t) => parseInt(t.split(":")[0])))
    : 8;
  const maxHour = allTimes.length > 0
    ? Math.max(...allTimes.map((t) => parseInt(t.split(":")[0]))) + 1
    : 18;

  const hours = [];
  for (let h = minHour; h <= maxHour; h++) {
    hours.push(h);
  }

  // 훈련 카드의 위치 계산 (top %, height %)
  const totalMinutes = (maxHour - minHour + 1) * 60;
  function getPosition(startTime?: string | null, endTime?: string | null) {
    if (!startTime || !endTime) return { top: 0, height: 60 };
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startMin = (sh - minHour) * 60 + sm;
    const endMin = (eh - minHour) * 60 + em;
    return {
      top: (startMin / totalMinutes) * 100,
      height: Math.max(((endMin - startMin) / totalMinutes) * 100, 3),
    };
  }

  const typeColors: Record<string, string> = {
    "사격": "bg-red-100 text-red-700 border-red-200",
    "화생방": "bg-yellow-100 text-yellow-700 border-yellow-200",
    "전술": "bg-green-100 text-green-700 border-green-200",
    "체력": "bg-blue-100 text-blue-700 border-blue-200",
    "정신교육": "bg-purple-100 text-purple-700 border-purple-200",
    "기타": "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <div className="max-w-3xl">
      <PageTitle title="일일 훈련 일정" description={headerStr} />

      {trainings.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">해당 날짜에 훈련이 없습니다.</p>
          <Link href="/trainings" className="text-blue-600 text-sm mt-2 inline-block hover:underline">
            &larr; 목록으로
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border p-4">
          {/* 타임라인 */}
          <div className="relative" style={{ minHeight: `${hours.length * 64}px` }}>
            {/* 시간 눈금 */}
            {hours.map((h) => {
              const topPx = ((h - minHour) * 60 / totalMinutes) * 100;
              return (
                <div
                  key={h}
                  className="absolute left-0 right-0 flex items-start"
                  style={{ top: `${topPx}%` }}
                >
                  <span className="text-xs text-gray-400 w-12 shrink-0 -mt-2">
                    {String(h).padStart(2, "0")}:00
                  </span>
                  <div className="flex-1 border-t border-gray-100" />
                </div>
              );
            })}

            {/* 훈련 카드들 */}
            {trainings.map((training) => {
              const pos = getPosition(training.startTime, training.endTime);
              const colorClass = typeColors[training.type] || typeColors["기타"];

              return (
                <Link
                  key={training.id}
                  href={`/trainings/${training.id}`}
                  className="absolute left-14 right-2 group"
                  style={{ top: `${pos.top}%`, height: `${pos.height}%`, minHeight: "48px" }}
                >
                  <div
                    className={`h-full rounded-lg border-l-4 p-2.5 ${colorClass} hover:shadow-md transition-shadow overflow-hidden`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-white/60">
                        {training.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {training.startTime} ~ {training.endTime}
                      </span>
                    </div>
                    <p className="text-sm font-semibold truncate">{training.title}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {training.location && <span>{training.location}</span>}
                      {training.instructor && <span>교관: {training.instructor.name}</span>}
                    </div>
                    {training.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{training.description}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t text-center">
            <Link href="/trainings" className="text-sm text-blue-600 hover:underline">
              &larr; 훈련 목록으로
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
