import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      batchUsers: { select: { user: { select: { id: true, name: true, rank: true, serviceNumber: true, phone: true, unit: true } } } },
      trainings: {
        orderBy: { date: "asc" },
        include: { instructor: { select: { id: true, name: true } } },
      },
      _count: { select: { batchUsers: true, trainings: true } },
    },
  });

  if (!batch) return notFound("차수를 찾을 수 없습니다.");

  const { batchUsers, _count, ...rest } = batch;
  return json({
    ...rest,
    users: batchUsers.map((bu) => bu.user),
    _count: { users: _count.batchUsers, trainings: _count.trainings },
    status: computeBatchStatus(batch.startDate, batch.endDate),
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();
  const batch = await prisma.batch.update({
    where: { id },
    data: {
      name: body.name,
      year: body.year,
      number: body.number,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      location: body.location,
      requiredHours: body.requiredHours !== undefined ? (body.requiredHours != null && body.requiredHours !== "" ? parseFloat(body.requiredHours) : null) : undefined,
    },
  });

  return json({
    ...batch,
    status: computeBatchStatus(batch.startDate, batch.endDate),
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  try {
    await prisma.batch.delete({ where: { id } });
    return json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "삭제에 실패했습니다.";
    return json({ error: message }, 500);
  }
}
