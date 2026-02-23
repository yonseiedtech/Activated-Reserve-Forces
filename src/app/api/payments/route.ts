import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { calcCompensation } from "@/lib/compensation";

// 차수별 훈련비 종합 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  let batchId = searchParams.get("batchId");

  // RESERVIST는 자기 차수만 (가장 최근)
  if (session.user.role === "RESERVIST") {
    const latestBatchUser = await prisma.batchUser.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { batchId: true },
    });
    if (!latestBatchUser) return json({ process: null, compensations: [], transport: null, batches: [] });
    batchId = latestBatchUser.batchId;
  }

  // 차수 목록 (관리자용)
  const batches = ["ADMIN", "MANAGER"].includes(session.user.role)
    ? await prisma.batch.findMany({ orderBy: { startDate: "desc" }, select: { id: true, name: true } })
    : [];

  if (!batchId) {
    // 기본: 첫 번째 차수
    const first = batches[0];
    if (!first) return json({ process: null, compensations: [], transport: null, batches });
    batchId = first.id;
  }

  // PaymentProcess 자동 생성 (없으면)
  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) return badRequest("차수를 찾을 수 없습니다.");

  let process = await prisma.paymentProcess.findUnique({ where: { batchId } });
  if (!process) {
    process = await prisma.paymentProcess.create({
      data: {
        batchId,
        title: `${batch.name} 훈련비`,
        status: "DOC_DRAFT",
      },
    });
  }

  // 훈련 목록 + 보상비 계산
  const trainings = await prisma.training.findMany({
    where: { batchId },
    orderBy: { date: "asc" },
    include: { compensation: true },
  });

  const compensations = trainings.map((t) => {
    const calc = calcCompensation(t);
    const finalRate = t.compensation?.overrideRate ?? t.compensation?.dailyRate ?? calc.dailyRate;
    return {
      trainingId: t.id,
      title: t.title,
      type: t.type,
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      trainingHours: t.compensation?.trainingHours ?? calc.trainingHours,
      isWeekend: t.compensation?.isWeekend ?? calc.isWeekend,
      dailyRate: t.compensation?.dailyRate ?? calc.dailyRate,
      overrideRate: t.compensation?.overrideRate ?? null,
      finalRate,
    };
  });

  // 교통비 (RESERVIST: 본인만, ADMIN: 전체)
  let transport;
  if (session.user.role === "RESERVIST") {
    transport = await prisma.userTransportAllowance.findUnique({
      where: { userId_batchId: { userId: session.user.id, batchId } },
    });
  } else {
    transport = await prisma.userTransportAllowance.findMany({
      where: { batchId },
      include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
      orderBy: { user: { name: "asc" } },
    });
  }

  return json({ process, compensations, transport, batches, batchId, batchName: batch.name, requiredHours: batch.requiredHours });
}
