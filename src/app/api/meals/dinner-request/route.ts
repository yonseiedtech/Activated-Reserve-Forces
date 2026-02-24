import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

/** N 근무일 전 날짜 계산 (토/일 제외) */
function subtractBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }
  return result;
}

/** 오늘이 마감일 이전(또는 같은 날)인지 확인 */
function isBeforeOrEqual(today: Date, deadline: Date): boolean {
  const t = new Date(today); t.setHours(0, 0, 0, 0);
  const d = new Date(deadline); d.setHours(0, 0, 0, 0);
  return t.getTime() <= d.getTime();
}

// 석식 신청 목록 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = req.nextUrl;
  const batchId = searchParams.get("batchId");

  if (!batchId) return badRequest("batchId가 필요합니다.");

  const isAdmin = ["ADMIN", "MANAGER", "COOK"].includes(session.user.role);

  const requests = await prisma.dinnerRequest.findMany({
    where: {
      batchId,
      ...(isAdmin ? {} : { userId: session.user.id }),
    },
    include: {
      user: { select: { name: true, rank: true, serviceNumber: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  // 차수 정보도 함께 반환 (마감일 계산용)
  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: { startDate: true, endDate: true },
  });

  if (!batch) return badRequest("차수를 찾을 수 없습니다.");

  const applyDeadline = subtractBusinessDays(batch.startDate, 9);
  const cancelDeadline = subtractBusinessDays(batch.startDate, 3);

  return json({
    requests,
    deadlines: {
      applyDeadline: applyDeadline.toISOString(),
      cancelDeadline: cancelDeadline.toISOString(),
    },
  });
}

// 석식 신청 (예비역) — 날짜 자동: 차수 시작일
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const { batchId } = body as { batchId: string };

  if (!batchId) return badRequest("batchId가 필요합니다.");

  // 차수 조회
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) return badRequest("차수를 찾을 수 없습니다.");

  // 9근무일 전 마감 체크
  const applyDeadline = subtractBusinessDays(batch.startDate, 9);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!isBeforeOrEqual(today, applyDeadline)) {
    const dl = applyDeadline.toLocaleDateString("ko-KR");
    return badRequest(`석식 신청 마감일(${dl})이 지났습니다.`);
  }

  // 이미 신청했는지 확인
  const existing = await prisma.dinnerRequest.findFirst({
    where: {
      userId: session.user.id,
      batchId,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existing) {
    return badRequest("이미 석식을 신청하셨습니다.");
  }

  const request = await prisma.dinnerRequest.create({
    data: {
      userId: session.user.id,
      batchId,
      date: batch.startDate, // 차수 시작일 기준
      status: "PENDING",
    },
  });

  // 관리자/급식담당자에게 알림 생성
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "COOK"] } },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        title: "석식 신청",
        content: `${session.user.name}님이 ${batch.name} 석식을 신청했습니다.`,
        type: "GENERAL",
      })),
    });
  }

  return json(request, 201);
}

// 석식 취소/승인/반려
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const { requestId, action } = body as {
    requestId: string;
    action: "approve" | "reject" | "cancel";
  };

  if (!requestId || !action) return badRequest("requestId와 action이 필요합니다.");

  const request = await prisma.dinnerRequest.findUnique({
    where: { id: requestId },
    include: { batch: true },
  });
  if (!request) return badRequest("신청을 찾을 수 없습니다.");

  // 취소: 본인만, 3근무일 전까지
  if (action === "cancel") {
    if (request.userId !== session.user.id) return forbidden();

    const cancelDeadline = subtractBusinessDays(request.batch.startDate, 3);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!isBeforeOrEqual(today, cancelDeadline)) {
      const dl = cancelDeadline.toLocaleDateString("ko-KR");
      return badRequest(`석식 취소 마감일(${dl})이 지났습니다.`);
    }

    const updated = await prisma.dinnerRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });

    // 관리자에게 취소 알림
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER", "COOK"] } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: "석식 신청 취소",
          content: `${session.user.name}님이 ${request.batch.name} 석식 신청을 취소했습니다.`,
          type: "GENERAL",
        })),
      });
    }

    return json(updated);
  }

  // 승인/반려: 관리자만
  if (!["ADMIN", "MANAGER", "COOK"].includes(session.user.role)) return forbidden();

  if (action === "approve") {
    const updated = await prisma.dinnerRequest.update({
      where: { id: requestId },
      data: { status: "APPROVED" },
    });
    return json(updated);
  }

  if (action === "reject") {
    const updated = await prisma.dinnerRequest.update({
      where: { id: requestId },
      data: { status: "REJECTED" },
    });
    return json(updated);
  }

  return badRequest("유효하지 않은 action입니다.");
}
