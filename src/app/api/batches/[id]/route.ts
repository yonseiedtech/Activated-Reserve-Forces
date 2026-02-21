import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      users: { select: { id: true, name: true, rank: true, serviceNumber: true, phone: true } },
      trainings: { orderBy: { date: "asc" } },
      _count: { select: { users: true, trainings: true } },
    },
  });

  if (!batch) return notFound("차수를 찾을 수 없습니다.");
  return json(batch);
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
      status: body.status,
    },
  });

  return json(batch);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  await prisma.batch.delete({ where: { id } });
  return json({ success: true });
}
