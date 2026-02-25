import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";

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
  const role = session.user.role;

  const isReservist = role === "RESERVIST";
  if (!["ADMIN", "MANAGER", "INSTRUCTOR", "RESERVIST"].includes(role)) return forbidden();

  const batches = await prisma.batch.findMany({
    where: isReservist
      ? { batchUsers: { some: { userId: session.user.id } } }
      : undefined,
    orderBy: [{ year: "desc" }, { number: "desc" }],
    include: {
      batchUsers: {
        select: {
          userId: true,
          status: true,
          subStatus: true,
          reason: true,
          user: { select: { id: true, name: true, rank: true } },
        },
      },
      trainings: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          startTime: true,
          endTime: true,
          countsTowardHours: true,
          attendances: { select: { userId: true, status: true } },
        },
      },
    },
  });

  const result = batches.map((batch) => {
    const users = batch.batchUsers.map((bu) => bu.user);
    const trainings = batch.trainings;
    const totalUsers = users.length;

    // 차수의 startDate 요일로 평일/주말 판단
    const batchStartDay = new Date(batch.startDate).getUTCDay();
    const batchDayType: "weekday" | "weekend" = (batchStartDay === 0 || batchStartDay === 6) ? "weekend" : "weekday";

    // 차수 종합 출석률
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalPending = 0;
    let totalAttendances = 0;
    for (const t of trainings) {
      totalPresent += t.attendances.filter((a) => a.status === "PRESENT").length;
      totalAbsent += t.attendances.filter((a) => a.status === "ABSENT").length;
      totalPending += t.attendances.filter((a) => a.status === "PENDING").length;
      totalAttendances += t.attendances.length;
    }

    // 인원별 출석률
    const byUser = users.map((user) => {
      let present = 0;
      let absent = 0;
      let pending = 0;
      for (const t of trainings) {
        const att = t.attendances.find((a) => a.userId === user.id);
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

    // 이수시간 계산 (countsTowardHours인 훈련만, 시간 기반)
    let requiredHours = batch.requiredHours;
    if (!requiredHours) {
      // 훈련 시간표 기반으로 총 시간 계산
      let totalMins = 0;
      for (const t of trainings) {
        if (!t.countsTowardHours) continue;
        if (t.startTime && t.endTime) {
          const [sh, sm] = t.startTime.split(":").map(Number);
          const [eh, em] = t.endTime.split(":").map(Number);
          totalMins += (eh * 60 + em) - (sh * 60 + sm);
        }
      }
      requiredHours = totalMins > 0 ? Math.round(totalMins / 60) : null;
    }

    // batchUser 상태 매핑 (subStatus, reason 포함)
    const batchUserMap: Record<string, { status: string; subStatus: string | null; reason: string | null }> = {};
    for (const bu of batch.batchUsers) {
      batchUserMap[bu.userId] = { status: bu.status, subStatus: bu.subStatus, reason: bu.reason };
    }

    return {
      batchId: batch.id,
      batchName: batch.name,
      status: computeBatchStatus(batch.startDate, batch.endDate),
      startDate: batch.startDate,
      endDate: batch.endDate,
      totalUsers,
      totalTrainings: trainings.length,
      batchDayType,
      requiredHours,
      summary: {
        present: totalPresent,
        absent: totalAbsent,
        pending: totalPending,
        total: totalAttendances,
        rate: totalAttendances > 0 ? Math.round((totalPresent / totalAttendances) * 100) : 0,
      },
      byUser,
      batchUserMap,
    };
  });

  return json(result);
}
