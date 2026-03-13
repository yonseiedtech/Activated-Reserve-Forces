import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { parseDate, getKstToday } from "@/lib/date-utils";

function computeBatchStatus(startDate: Date, endDate: Date): string {
  const today = getKstToday();
  const start = new Date(new Date(startDate).toISOString().split("T")[0] + "T00:00:00.000Z");
  const end = new Date(new Date(endDate).toISOString().split("T")[0] + "T00:00:00.000Z");
  if (today < start) return "PLANNED";
  if (today > end) return "COMPLETED";
  return "ACTIVE";
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const isReservist = session.user.role === "RESERVIST";

  const batches = await prisma.batch.findMany({
    where: isReservist
      ? { batchUsers: { some: { userId: session.user.id } } }
      : undefined,
    orderBy: { startDate: "asc" },
    include: {
      _count: { select: { batchUsers: true, trainings: true } },
      ...(isReservist ? {
        batchUsers: {
          where: { userId: session.user.id },
          select: { status: true },
        },
      } : {}),
    },
  });

  const batchesWithStatus = batches.map((b) => {
    const { _count, batchUsers, ...rest } = b as typeof b & { batchUsers?: { status: string }[] };
    const myAttendanceStatus = batchUsers?.[0]?.status || null;
    return {
      ...rest,
      _count: { users: _count.batchUsers, trainings: _count.trainings },
      status: computeBatchStatus(b.startDate, b.endDate),
      ...(isReservist ? { myAttendanceStatus } : {}),
    };
  });

  return json(batchesWithStatus);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  if (!body.name || !body.year || !body.number || !body.startDate) {
    return badRequest("차수명, 연도, 차수 번호, 시작일은 필수 항목입니다.");
  }

  const batch = await prisma.batch.create({
    data: {
      name: body.name,
      year: body.year,
      number: body.number,
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate || body.startDate),
      status: body.status || "PLANNED",
      location: body.location || null,
      requiredHours: body.requiredHours != null && body.requiredHours !== "" ? parseFloat(body.requiredHours) : null,
      startTime: body.startTime || null,
      endTime: body.endTime || null,
      unitId: body.unitId || null,
    },
  });

  return json(batch, 201);
}
