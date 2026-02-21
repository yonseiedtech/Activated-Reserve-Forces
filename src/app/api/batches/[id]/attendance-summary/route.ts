import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;

  const batch = await prisma.batch.findUnique({
    where: { id },
    include: {
      batchUsers: { select: { user: { select: { id: true, name: true, rank: true } } } },
      trainings: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          title: true,
          date: true,
          attendances: { select: { userId: true, status: true } },
        },
      },
    },
  });

  if (!batch) return notFound("차수를 찾을 수 없습니다.");

  const users = batch.batchUsers.map((bu) => bu.user);

  // Per-user summary
  const byUser = users.map((user) => {
    let present = 0;
    let absent = 0;
    let pending = 0;
    for (const training of batch.trainings) {
      const att = training.attendances.find((a) => a.userId === user.id);
      if (att) {
        if (att.status === "PRESENT") present++;
        else if (att.status === "ABSENT") absent++;
        else pending++;
      }
    }
    const total = present + absent + pending;
    return {
      userId: user.id,
      name: user.name,
      rank: user.rank,
      present,
      absent,
      pending,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });

  // Per-training summary
  const byTraining = batch.trainings.map((training) => {
    const present = training.attendances.filter((a) => a.status === "PRESENT").length;
    const total = training.attendances.length;
    return {
      trainingId: training.id,
      title: training.title,
      date: training.date,
      present,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  });

  return json({ byUser, byTraining });
}
