import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const training = await prisma.training.findUnique({
    where: { id },
    include: {
      batch: true,
      instructor: { select: { id: true, name: true } },
      attendances: {
        include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
      },
    },
  });

  if (!training) return notFound("훈련을 찾을 수 없습니다.");
  return json(training);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();
  const training = await prisma.training.update({
    where: { id },
    data: {
      title: body.title,
      type: body.type,
      date: body.date ? new Date(body.date) : undefined,
      startTime: body.startTime,
      endTime: body.endTime,
      location: body.location,
      description: body.description,
      instructorId: body.instructorId,
      attendanceEnabled: body.attendanceEnabled,
      countsTowardHours: body.countsTowardHours,
    },
  });

  return json(training);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  await prisma.training.delete({ where: { id } });
  return json({ success: true });
}
