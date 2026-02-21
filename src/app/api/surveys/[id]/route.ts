import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: { responses: { include: { user: { select: { id: true, name: true } } } } },
  });

  if (!survey) return notFound();

  // 본인 응답 여부 확인
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
