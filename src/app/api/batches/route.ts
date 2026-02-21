import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

function computeBatchStatus(startDate: Date, endDate: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  if (today < start) return "PLANNED";
  if (today > end) return "COMPLETED";
  return "ACTIVE";
}

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const batches = await prisma.batch.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { batchUsers: true, trainings: true } } },
  });

  const batchesWithStatus = batches.map((b) => {
    const { _count, ...rest } = b;
    return {
      ...rest,
      _count: { users: _count.batchUsers, trainings: _count.trainings },
      status: computeBatchStatus(b.startDate, b.endDate),
    };
  });

  return json(batchesWithStatus);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const batch = await prisma.batch.create({
    data: {
      name: body.name,
      year: body.year,
      number: body.number,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: body.status || "PLANNED",
    },
  });

  return json(batch, 201);
}
