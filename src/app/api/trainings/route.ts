import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest, NextResponse } from "next/server";
import { parseDate } from "@/lib/date-utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const where = batchId ? { batchId } : {};

  // 대상자는 자기 차수 훈련만 조회
  if (session.user.role === "RESERVIST") {
    const batchUsers = await prisma.batchUser.findMany({
      where: { userId: session.user.id },
      select: { batchId: true },
    });
    const batchIds = batchUsers.map((bu) => bu.batchId);
    if (batchIds.length > 0) {
      Object.assign(where, { batchId: { in: batchIds } });
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

  // Time conflict check: same batch, same date, overlapping times
  if (body.startTime && body.endTime && body.batchId) {
    const trainingDate = parseDate(body.date);
    const dayStart = new Date(trainingDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86400000);

    const existing = await prisma.training.findMany({
      where: {
        batchId: body.batchId,
        date: { gte: dayStart, lt: dayEnd },
        startTime: { not: null },
        endTime: { not: null },
      },
      select: { id: true, title: true, startTime: true, endTime: true },
    });

    const toMinutes = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };

    const newStart = toMinutes(body.startTime);
    const newEnd = toMinutes(body.endTime);

    for (const t of existing) {
      const exStart = toMinutes(t.startTime!);
      const exEnd = toMinutes(t.endTime!);
      if (newStart < exEnd && newEnd > exStart) {
        return NextResponse.json(
          { error: `"${t.title}" (${t.startTime}~${t.endTime})과 시간이 겹칩니다.` },
          { status: 409 }
        );
      }
    }
  }

  const training = await prisma.training.create({
    data: {
      title: body.title,
      type: body.type,
      date: parseDate(body.date),
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      description: body.description,
      batchId: body.batchId,
      instructorId: body.instructorId,
      attendanceEnabled: body.attendanceEnabled ?? true,
      countsTowardHours: body.countsTowardHours ?? true,
    },
  });

  return json(training, 201);
}
