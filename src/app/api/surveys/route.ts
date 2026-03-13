import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { parseDate } from "@/lib/date-utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = req.nextUrl;
  const batchId = searchParams.get("batchId");

  // RESERVIST는 자기 차수의 활성 설문만 조회
  let where: Record<string, unknown> = {};
  if (session.user.role === "RESERVIST") {
    const myBatches = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    const myBatchIds = myBatches.map((b) => b.batchId);
    where = { isActive: true, batchId: { in: myBatchIds } };
  } else if (batchId) {
    where = { batchId };
  }

  const surveys = await prisma.survey.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { responses: true } } },
  });

  return json(surveys);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const survey = await prisma.survey.create({
    data: {
      title: body.title,
      description: body.description || null,
      questions: JSON.stringify(body.questions),
      startDate: body.startDate ? parseDate(body.startDate) : null,
      endDate: body.endDate ? parseDate(body.endDate) : null,
      batchId: body.batchId || null,
    },
  });

  return json(survey, 201);
}
