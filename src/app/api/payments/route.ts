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
    include: {
      compensation: true,
      attendances: {
        where: { status: "PRESENT" },
        include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
      },
    },
  });

  const compensations = trainings.map((t) => {
    const calc = calcCompensation(t);
    // countsTowardHours가 false인 훈련(식사 등)은 이수시간·보상비 0으로 처리
    const effectiveHours = t.countsTowardHours ? (t.compensation?.trainingHours ?? calc.trainingHours) : 0;
    const effectiveRate = t.countsTowardHours ? (t.compensation?.dailyRate ?? calc.dailyRate) : 0;
    const finalRate = t.countsTowardHours ? (t.compensation?.overrideRate ?? effectiveRate) : 0;
    return {
      trainingId: t.id,
      title: t.title,
      type: t.type,
      date: t.date,
      startTime: t.startTime,
      endTime: t.endTime,
      trainingHours: effectiveHours,
      isWeekend: t.compensation?.isWeekend ?? calc.isWeekend,
      dailyRate: effectiveRate,
      overrideRate: t.countsTowardHours ? (t.compensation?.overrideRate ?? null) : null,
      finalRate,
      attendanceEnabled: t.attendanceEnabled,
      countsTowardHours: t.countsTowardHours,
    };
  });

  // 관리자용: 대상자별 보상비 행
  let compensationsByUser;
  if (["ADMIN", "MANAGER"].includes(session.user.role)) {
    // attendanceEnabled가 false인 훈련이 있으면, 차수 배정 대상자(참석) 전체를 가져옴
    const hasNonAttendance = trainings.some((t) => !t.attendanceEnabled);
    let batchUsers: { userId: string; user: { id: string; name: string; rank: string | null; serviceNumber: string | null } }[] = [];
    if (hasNonAttendance) {
      batchUsers = await prisma.batchUser.findMany({
        where: { batchId, status: "PRESENT" },
        include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
      });
    }

    compensationsByUser = trainings.flatMap((t) => {
      const calc = calcCompensation(t);
      const effectiveHours = t.countsTowardHours ? (t.compensation?.trainingHours ?? calc.trainingHours) : 0;
      const baseRate = t.countsTowardHours ? (t.compensation?.dailyRate ?? calc.dailyRate) : 0;
      const finalRate = t.countsTowardHours ? (t.compensation?.overrideRate ?? baseRate) : 0;

      // attendanceEnabled가 false이면 차수 배정 대상자 전원 포함
      const users = t.attendanceEnabled
        ? t.attendances.map((att) => att.user)
        : batchUsers.map((bu) => bu.user);

      return users.map((user) => ({
        trainingId: t.id,
        title: t.title,
        type: t.type,
        date: t.date,
        startTime: t.startTime,
        endTime: t.endTime,
        trainingHours: effectiveHours,
        isWeekend: t.compensation?.isWeekend ?? calc.isWeekend,
        dailyRate: baseRate,
        overrideRate: t.countsTowardHours ? (t.compensation?.overrideRate ?? null) : null,
        finalRate,
        userId: user.id,
        userName: user.name,
        rank: user.rank,
        serviceNumber: user.serviceNumber,
      }));
    });
  }

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

  return json({ process, compensations, compensationsByUser, transport, batches, batchId, batchName: batch.name, requiredHours: batch.requiredHours });
}
