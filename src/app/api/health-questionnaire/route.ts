import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET: 문진표 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const batchUserId = req.nextUrl.searchParams.get("batchUserId");
  const batchId = req.nextUrl.searchParams.get("batchId");
  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);

  if (batchId && isAdmin) {
    // 관리자: 차수 전체 문진표 조회
    const questionnaires = await prisma.healthQuestionnaire.findMany({
      where: { batchUser: { batchId } },
      include: {
        batchUser: {
          include: {
            user: { select: { id: true, name: true, rank: true, serviceNumber: true, unit: true, birthDate: true } },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });
    return json(questionnaires);
  }

  if (batchUserId) {
    const batchUser = await prisma.batchUser.findUnique({ where: { id: batchUserId } });
    if (!batchUser) return badRequest("batchUser를 찾을 수 없습니다.");
    if (!isAdmin && batchUser.userId !== session.user.id) return forbidden();

    const questionnaire = await prisma.healthQuestionnaire.findUnique({
      where: { batchUserId },
    });
    return json(questionnaire);
  }

  return badRequest("batchUserId 또는 batchId 파라미터가 필요합니다.");
}

// POST: 문진표 제출/수정
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const { batchUserId, answers } = body as { batchUserId: string; answers: string };

  if (!batchUserId || !answers) return badRequest("batchUserId, answers가 필요합니다.");

  const batchUser = await prisma.batchUser.findUnique({
    where: { id: batchUserId },
    include: { batch: { select: { startDate: true, endDate: true } } },
  });
  if (!batchUser) return badRequest("batchUser를 찾을 수 없습니다.");

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);
  if (!isAdmin && batchUser.userId !== session.user.id) return forbidden();

  // 대상자: 차수 기간 내에서만 문진표 작성 가능 (시작일 3일 전 ~ 종료일)
  if (!isAdmin) {
    const now = new Date();
    const batchStart = new Date(batchUser.batch.startDate);
    const earlyStart = new Date(batchStart.getTime() - 3 * 24 * 60 * 60 * 1000);
    const batchEnd = new Date(batchUser.batch.endDate);
    batchEnd.setHours(23, 59, 59, 999);
    if (now < earlyStart || now > batchEnd) {
      return badRequest("문진표는 훈련 시작 3일 전부터 훈련 종료일까지만 작성할 수 있습니다.");
    }
  }

  // JSON 유효성 검증
  try {
    JSON.parse(answers);
  } catch {
    return badRequest("answers는 유효한 JSON이어야 합니다.");
  }

  const result = await prisma.healthQuestionnaire.upsert({
    where: { batchUserId },
    create: { batchUserId, answers, submittedAt: new Date() },
    update: { answers, submittedAt: new Date() },
  });

  return json(result);
}

// DELETE: 관리자가 문진표 삭제 (대상자가 다시 작성할 수 있도록)
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return badRequest("id 파라미터가 필요합니다.");

  const existing = await prisma.healthQuestionnaire.findUnique({ where: { id } });
  if (!existing) return notFound("문진표를 찾을 수 없습니다.");

  await prisma.healthQuestionnaire.delete({ where: { id } });
  return json({ success: true });
}
