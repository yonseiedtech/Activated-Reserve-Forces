import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
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

  const batchUser = await prisma.batchUser.findUnique({ where: { id: batchUserId } });
  if (!batchUser) return badRequest("batchUser를 찾을 수 없습니다.");

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);
  if (!isAdmin && batchUser.userId !== session.user.id) return forbidden();

  const result = await prisma.healthQuestionnaire.upsert({
    where: { batchUserId },
    create: { batchUserId, answers, submittedAt: new Date() },
    update: { answers, submittedAt: new Date() },
  });

  return json(result);
}
