import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const date = searchParams.get("date");

  if (!batchId || !date) return badRequest("batchId와 date가 필요합니다.");

  // 해당 차수/날짜의 훈련 찾기
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const training = await prisma.training.findFirst({
    where: {
      batchId,
      date: { gte: startOfDay, lte: endOfDay },
    },
    select: { id: true },
  });

  if (!training) {
    const totalBatchUsers = await prisma.batchUser.count({ where: { batchId } });
    return json({ presentCount: 0, pendingCount: 0, totalBatchUsers });
  }

  const attendances = await prisma.attendance.findMany({
    where: { trainingId: training.id },
    select: { status: true },
  });

  const presentCount = attendances.filter((a) => a.status === "PRESENT").length;
  const pendingCount = attendances.filter((a) => a.status === "PENDING").length;
  const totalBatchUsers = await prisma.batchUser.count({ where: { batchId } });

  return json({ presentCount, pendingCount, totalBatchUsers });
}
