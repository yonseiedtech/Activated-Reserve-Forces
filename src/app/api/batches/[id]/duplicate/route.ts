import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { parseDate } from "@/lib/date-utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  if (!body.name || !body.startDate || !body.endDate) {
    return badRequest("차수명, 시작일, 종료일은 필수입니다.");
  }

  const sourceBatch = await prisma.batch.findUnique({
    where: { id },
    include: {
      trainings: {
        select: {
          title: true,
          type: true,
          date: true,
          startTime: true,
          endTime: true,
          location: true,
          description: true,
          instructorId: true,
          attendanceEnabled: true,
          countsTowardHours: true,
        },
      },
    },
  });

  if (!sourceBatch) return notFound("원본 차수를 찾을 수 없습니다.");

  const newStartDate = parseDate(body.startDate);
  const oldStartDate = new Date(sourceBatch.startDate);
  const offsetMs = newStartDate.getTime() - oldStartDate.getTime();

  const newBatch = await prisma.batch.create({
    data: {
      name: body.name,
      year: body.year || newStartDate.getFullYear(),
      number: body.number || sourceBatch.number,
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate),
      status: "PLANNED",
      location: body.location ?? sourceBatch.location,
      requiredHours: body.requiredHours != null && body.requiredHours !== "" ? parseFloat(body.requiredHours) : sourceBatch.requiredHours,
      trainings: {
        create: sourceBatch.trainings.map((t) => ({
          title: t.title,
          type: t.type,
          date: new Date(new Date(t.date).getTime() + offsetMs),
          startTime: t.startTime,
          endTime: t.endTime,
          location: t.location,
          description: t.description,
          instructorId: t.instructorId,
          attendanceEnabled: t.attendanceEnabled,
          countsTowardHours: t.countsTowardHours,
        })),
      },
    },
    include: { _count: { select: { batchUsers: true, trainings: true } } },
  });

  const { _count, ...rest } = newBatch;
  return json({ ...rest, _count: { users: _count.batchUsers, trainings: _count.trainings } }, 201);
}
