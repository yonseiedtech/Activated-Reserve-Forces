import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// 출퇴근 시간으로 이수시간 계산 (점심 11:30~12:30 제외, 0.5시간 단위 내림)
function calcWorkHours(checkInAt: Date, checkOutAt: Date): number {
  const inMin = checkInAt.getUTCHours() * 60 + checkInAt.getUTCMinutes() + 9 * 60; // KST
  const outMin = checkOutAt.getUTCHours() * 60 + checkOutAt.getUTCMinutes() + 9 * 60;
  if (outMin <= inMin) return 0;

  const LUNCH_START = 11 * 60 + 30; // 11:30
  const LUNCH_END = 12 * 60 + 30;   // 12:30

  let totalMin = 0;

  if (inMin >= LUNCH_END || outMin <= LUNCH_START) {
    // 점심시간과 겹치지 않음
    totalMin = outMin - inMin;
  } else {
    // 점심 전 구간
    if (inMin < LUNCH_START) {
      totalMin += LUNCH_START - inMin;
    }
    // 점심 후 구간
    if (outMin > LUNCH_END) {
      totalMin += outMin - LUNCH_END;
    }
  }

  // 0.5시간(30분) 단위 내림
  return Math.floor(totalMin / 30) * 0.5;
}

// GET: 차수별 결산 데이터 조회
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;

  const batch = await prisma.batch.findUnique({
    where: { id },
    select: {
      id: true,
      requiredHours: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!batch) return badRequest("차수를 찾을 수 없습니다.");

  // 출근 처리된(checkInAt 있는) 참석자 조회
  const batchUsers = await prisma.batchUser.findMany({
    where: { batchId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          rank: true,
          serviceNumber: true,
        },
      },
    },
  });

  // 출퇴근 기록 조회 (checkInAt이 있는 것만)
  const commutingRecords = await prisma.commutingRecord.findMany({
    where: {
      batchId: id,
      checkInAt: { not: null },
    },
  });

  const checkedInUserIds = new Set(commutingRecords.map((r) => r.userId));

  // 사용자별 출퇴근 기록으로 이수시간 합산 (여러 날에 걸쳐)
  const calcHoursMap = new Map<string, number>();
  for (const rec of commutingRecords) {
    if (!rec.checkInAt || !rec.checkOutAt) continue;
    const hours = calcWorkHours(rec.checkInAt, rec.checkOutAt);
    calcHoursMap.set(rec.userId, (calcHoursMap.get(rec.userId) || 0) + hours);
  }

  const rows = batchUsers
    .filter((bu) => checkedInUserIds.has(bu.userId))
    .map((bu) => ({
      batchUserId: bu.id,
      userId: bu.userId,
      name: bu.user.name,
      rank: bu.user.rank,
      serviceNumber: bu.user.serviceNumber,
      completedHours: bu.completedHours,
      calculatedHours: calcHoursMap.get(bu.userId) ?? null,
    }));

  return json({
    requiredHours: batch.requiredHours,
    startDate: batch.startDate,
    endDate: batch.endDate,
    rows,
  });
}

// PUT: 이수시간 일괄 저장
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  if (!body.rows || !Array.isArray(body.rows)) {
    return badRequest("rows 배열이 필요합니다.");
  }

  const updates = body.rows.map((row: { batchUserId: string; completedHours: number | null }) =>
    prisma.batchUser.update({
      where: { id: row.batchUserId, batchId: id },
      data: { completedHours: row.completedHours },
    })
  );

  await prisma.$transaction(updates);

  return json({ success: true });
}
