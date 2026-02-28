import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: { responses: { include: { user: { select: { id: true, name: true, rank: true } } } } },
  });

  if (!survey) return notFound();

  const myResponse = survey.responses.find((r) => r.userId === session.user.id);

  return json({ ...survey, myResponse });
}

// 설문 응답 제출
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await req.json();

  const response = await prisma.surveyResponse.upsert({
    where: { surveyId_userId: { surveyId: id, userId: session.user.id } },
    create: {
      surveyId: id,
      userId: session.user.id,
      answers: JSON.stringify(body.answers),
    },
    update: {
      answers: JSON.stringify(body.answers),
    },
  });

  return json(response);
}

// 설문 수정
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.survey.findUnique({ where: { id } });
  if (!existing) return notFound();

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.questions !== undefined) data.questions = JSON.stringify(body.questions);
  if (body.isActive !== undefined) data.isActive = body.isActive;

  if (Object.keys(data).length === 0) return badRequest("수정할 항목이 없습니다.");

  const updated = await prisma.survey.update({ where: { id }, data });
  return json(updated);
}

// 설문 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const existing = await prisma.survey.findUnique({ where: { id } });
  if (!existing) return notFound();

  await prisma.survey.delete({ where: { id } });
  return json({ success: true });
}
