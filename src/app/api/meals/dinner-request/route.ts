import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

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
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });

  return json(requests);
}

// 석식 신청 (예비역)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const { batchId, date } = body as { batchId: string; date: string };

  if (!batchId || !date) return badRequest("batchId와 date가 필요합니다.");

  // 신청일 기준 9근무일 전 체크
  const requestDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  requestDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 9) {
    return badRequest("석식 신청은 해당일 9근무일 전까지 가능합니다.");
  }

  const request = await prisma.dinnerRequest.upsert({
    where: {
      userId_batchId_date: {
        userId: session.user.id,
        batchId,
        date: new Date(date),
      },
    },
    create: {
      userId: session.user.id,
      batchId,
      date: new Date(date),
      status: "PENDING",
    },
    update: {
      status: "PENDING",
      updatedAt: new Date(),
    },
  });

  return json(request, 201);
}

// 석식 신청 취소/승인/반려 (관리자) 또는 취소 (본인)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const { requestId, action } = body as {
    requestId: string;
    action: "approve" | "reject" | "cancel";
  };

  if (!requestId || !action) return badRequest("requestId와 action이 필요합니다.");

  const request = await prisma.dinnerRequest.findUnique({ where: { id: requestId } });
  if (!request) return badRequest("신청을 찾을 수 없습니다.");

  // 취소: 본인만 가능, 3일 전까지
  if (action === "cancel") {
    if (request.userId !== session.user.id) return forbidden();
    const requestDate = new Date(request.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    requestDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((requestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 3) {
      return badRequest("석식 취소는 해당일 3일 전까지 가능합니다.");
    }
    const updated = await prisma.dinnerRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED" },
    });
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
