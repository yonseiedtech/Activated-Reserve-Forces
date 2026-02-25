import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET: 사유서 목록 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const batchUserId = req.nextUrl.searchParams.get("batchUserId");
  const batchId = req.nextUrl.searchParams.get("batchId");

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  if (batchId && isAdmin) {
    // 관리자: 차수 전체 사유서 조회
    const reports = await prisma.reasonReport.findMany({
      where: { batchUser: { batchId } },
      include: {
        batchUser: {
          include: {
            user: { select: { id: true, name: true, rank: true, serviceNumber: true, unit: true, branch: true } },
            batch: { select: { id: true, name: true, startDate: true, endDate: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return json(reports);
  }

  if (batchUserId) {
    // 본인 사유서 조회
    const batchUser = await prisma.batchUser.findUnique({ where: { id: batchUserId } });
    if (!batchUser) return badRequest("batchUser를 찾을 수 없습니다.");
    if (!isAdmin && batchUser.userId !== session.user.id) return forbidden();

    const reports = await prisma.reasonReport.findMany({
      where: { batchUserId },
      orderBy: { createdAt: "desc" },
    });
    return json(reports);
  }

  return badRequest("batchUserId 또는 batchId 파라미터가 필요합니다.");
}

// POST: 사유서 생성/수정 (upsert)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const { batchUserId, type, content } = body as {
    batchUserId: string;
    type: string;
    content: string;
  };

  if (!batchUserId || !type || !content) return badRequest("batchUserId, type, content가 필요합니다.");
  if (!["LATE_ARRIVAL", "EARLY_DEPARTURE", "ABSENT"].includes(type)) return badRequest("유효하지 않은 사유서 유형입니다.");

  const batchUser = await prisma.batchUser.findUnique({ where: { id: batchUserId } });
  if (!batchUser) return badRequest("batchUser를 찾을 수 없습니다.");

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);
  if (!isAdmin && batchUser.userId !== session.user.id) return forbidden();

  // 동일 유형 사유서가 있으면 수정, 없으면 생성
  const existing = await prisma.reasonReport.findFirst({
    where: { batchUserId, type },
  });

  if (existing) {
    const updated = await prisma.reasonReport.update({
      where: { id: existing.id },
      data: { content },
    });
    return json(updated);
  }

  const created = await prisma.reasonReport.create({
    data: { batchUserId, type, content },
  });
  return json(created, 201);
}
