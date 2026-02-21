import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ trainingId: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { trainingId } = await params;

  const training = await prisma.training.findUnique({
    where: { id: trainingId },
    include: { batch: { include: { users: { select: { id: true, name: true, rank: true, serviceNumber: true } } } } },
  });

  const attendances = await prisma.attendance.findMany({
    where: { trainingId },
    include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
  });

  return json({ training, attendances });
}
