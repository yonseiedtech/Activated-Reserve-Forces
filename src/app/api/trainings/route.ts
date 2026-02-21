import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const where = batchId ? { batchId } : {};

  // 대상자는 자기 차수 훈련만 조회
  if (session.user.role === "RESERVIST") {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user?.batchId) {
      Object.assign(where, { batchId: user.batchId });
    }
  }

  const trainings = await prisma.training.findMany({
    where,
    orderBy: { date: "asc" },
    include: {
      batch: { select: { name: true } },
      instructor: { select: { name: true } },
      _count: { select: { attendances: true } },
    },
  });

  return json(trainings);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const training = await prisma.training.create({
    data: {
      title: body.title,
      type: body.type,
      date: new Date(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      description: body.description,
      batchId: body.batchId,
      instructorId: body.instructorId,
    },
  });

  return json(training, 201);
}
