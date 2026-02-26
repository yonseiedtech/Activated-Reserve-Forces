import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { getDistance } from "@/lib/gps";
import { NextRequest } from "next/server";
import { parseDate } from "@/lib/date-utils";

// GET: 출퇴근 기록 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const userId = searchParams.get("userId");
  const batchId = searchParams.get("batchId");

  const where: Record<string, unknown> = {};

  if (date) {
    where.date = parseDate(date);
  }

  // 대상자는 자기 기록만 조회
  if (session.user.role === "RESERVIST") {
    where.userId = session.user.id;
  } else if (userId) {
    where.userId = userId;
  } else if (batchId) {
    // 차수별 대상자 필터링
    const batchUsers = await prisma.batchUser.findMany({
      where: { batchId },
      select: { userId: true },
    });
    where.userId = { in: batchUsers.map((bu) => bu.userId) };
  }

  const records = await prisma.commutingRecord.findMany({
    where,
    include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
    orderBy: { date: "desc" },
  });

  // 대상자에게는 GPS 좌표 숨기기
  if (session.user.role === "RESERVIST") {
    return json(records.map((r) => ({
      ...r,
      checkInLat: undefined,
      checkInLng: undefined,
      checkOutLat: undefined,
      checkOutLng: undefined,
    })));
  }

  return json(records);
}

// POST: 출퇴근 기록 (GPS 기반 or 관리자 수기)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  // 관리자 수기 입력
  if (body.isManual && isAdmin) {
    const record = await prisma.commutingRecord.upsert({
      where: {
        userId_date: {
          userId: body.userId,
          date: new Date(body.date.split("T")[0] + "T00:00:00.000Z"),
        },
      },
      create: {
        userId: body.userId,
        date: new Date(body.date.split("T")[0] + "T00:00:00.000Z"),
        checkInAt: body.checkInAt ? new Date(body.checkInAt) : undefined,
        checkOutAt: body.checkOutAt ? new Date(body.checkOutAt) : undefined,
        isManual: true,
        note: body.note,
        batchId: body.batchId || undefined,
      },
      update: {
        checkInAt: body.checkInAt ? new Date(body.checkInAt) : undefined,
        checkOutAt: body.checkOutAt ? new Date(body.checkOutAt) : undefined,
        isManual: true,
        note: body.note,
        batchId: body.batchId || undefined,
      },
    });
    return json(record);
  }

  // GPS 기반 출퇴근
  const { latitude, longitude, type } = body;
  if (!latitude || !longitude) return badRequest("GPS 좌표가 필요합니다.");

  // 활성 위치 확인
  const locations = await prisma.gpsLocation.findMany({ where: { isActive: true } });
  const inRange = locations.some(
    (loc) => getDistance(latitude, longitude, loc.latitude, loc.longitude) <= loc.radius
  );

  if (!inRange) return json({ error: "허용된 위치 범위 밖입니다.", allowed: false }, 400);

  // 오늘 날짜 (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");

  // 현재 활성 배치 자동 탐지
  const activeBatchUser = await prisma.batchUser.findFirst({
    where: {
      userId: session.user.id,
      batch: {
        startDate: { lte: now },
        endDate: { gte: today },
      },
    },
    select: { batchId: true },
  });
  const autoBatchId = activeBatchUser?.batchId || undefined;

  if (type === "checkIn") {
    const record = await prisma.commutingRecord.upsert({
      where: { userId_date: { userId: session.user.id, date: today } },
      create: {
        userId: session.user.id,
        date: today,
        checkInAt: now,
        checkInLat: latitude,
        checkInLng: longitude,
        batchId: autoBatchId,
      },
      update: {
        checkInAt: now,
        checkInLat: latitude,
        checkInLng: longitude,
      },
    });
    return json({ ...record, checkInLat: undefined, checkInLng: undefined });
  } else if (type === "checkOut") {
    const record = await prisma.commutingRecord.upsert({
      where: { userId_date: { userId: session.user.id, date: today } },
      create: {
        userId: session.user.id,
        date: today,
        checkOutAt: now,
        checkOutLat: latitude,
        checkOutLng: longitude,
        batchId: autoBatchId,
      },
      update: {
        checkOutAt: now,
        checkOutLat: latitude,
        checkOutLng: longitude,
      },
    });
    return json({ ...record, checkOutLat: undefined, checkOutLng: undefined });
  }

  return badRequest("type은 checkIn 또는 checkOut이어야 합니다.");
}
