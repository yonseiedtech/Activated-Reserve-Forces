import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

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

  const rows = batchUsers
    .filter((bu) => checkedInUserIds.has(bu.userId))
    .map((bu) => ({
      batchUserId: bu.id,
      userId: bu.userId,
      name: bu.user.name,
      rank: bu.user.rank,
      serviceNumber: bu.user.serviceNumber,
      completedHours: bu.completedHours,
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
