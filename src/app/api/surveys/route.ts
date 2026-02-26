import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { parseDate } from "@/lib/date-utils";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const surveys = await prisma.survey.findMany({
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
      description: body.description,
      questions: JSON.stringify(body.questions),
      startDate: body.startDate ? parseDate(body.startDate) : null,
      endDate: body.endDate ? parseDate(body.endDate) : null,
    },
  });

  return json(survey, 201);
}
