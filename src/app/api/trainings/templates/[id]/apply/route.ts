import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  if (!body.batchId || !body.date) {
    return badRequest("차수와 날짜를 선택해주세요.");
  }

  const template = await prisma.trainingTemplate.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!template) return notFound("템플릿을 찾을 수 없습니다.");
  if (template.items.length === 0) return badRequest("템플릿에 항목이 없습니다.");

  const trainingDate = new Date(body.date);
  const dayStart = new Date(trainingDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + 86400000);

  // 기존 훈련과의 시간 충돌 검사
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

  // 템플릿 항목 간 + 기존 훈련과의 충돌 검사
  const allSlots = existing.map((t) => ({
    title: t.title,
    start: toMinutes(t.startTime!),
    end: toMinutes(t.endTime!),
  }));

  for (const item of template.items) {
    const newStart = toMinutes(item.startTime);
    const newEnd = toMinutes(item.endTime);

    for (const slot of allSlots) {
      if (newStart < slot.end && newEnd > slot.start) {
        return NextResponse.json(
          { error: `"${item.title}" (${item.startTime}~${item.endTime})이 "${slot.title}"과 시간이 겹칩니다.` },
          { status: 409 }
        );
      }
    }

    allSlots.push({ title: item.title, start: newStart, end: newEnd });
  }

  // 일괄 생성
  const trainings = await prisma.$transaction(
    template.items.map((item) =>
      prisma.training.create({
        data: {
          title: item.title,
          type: item.type,
          date: trainingDate,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          description: item.description,
          batchId: body.batchId,
        },
      })
    )
  );

  return json({ count: trainings.length, trainings }, 201);
}
