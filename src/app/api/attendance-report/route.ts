import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const role = session.user.role;

  // 예비역: 본인이 배정된 차수만
  const isReservist = role === "RESERVIST";
  if (!["ADMIN", "MANAGER", "INSTRUCTOR", "RESERVIST"].includes(role)) return forbidden();

  const batches = await prisma.batch.findMany({
    where: isReservist
      ? { batchUsers: { some: { userId: session.user.id } } }
      : undefined,
    orderBy: [{ year: "desc" }, { number: "desc" }],
    include: {
      batchUsers: { select: { user: { select: { id: true, name: true, rank: true } } } },
      trainings: {
        orderBy: { date: "asc" },
        select: {
          id: true,
          title: true,
          type: true,
          date: true,
          attendances: { select: { userId: true, status: true } },
        },
      },
    },
  });

  const result = batches.map((batch) => {
    const users = batch.batchUsers.map((bu) => bu.user);
    const trainings = batch.trainings;
    const totalUsers = users.length;

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

    // 훈련유형별 출석률 (사격/화생방 등)
    const byTypeMap: Record<string, { present: number; absent: number; pending: number; total: number; count: number }> = {};
    // 평일/주말별
    const byDayTypeMap: Record<string, { present: number; absent: number; pending: number; total: number; count: number }> = {
      weekday: { present: 0, absent: 0, pending: 0, total: 0, count: 0 },
      weekend: { present: 0, absent: 0, pending: 0, total: 0, count: 0 },
    };

    for (const t of trainings) {
      const type = t.type || "기타";
      if (!byTypeMap[type]) byTypeMap[type] = { present: 0, absent: 0, pending: 0, total: 0, count: 0 };
      const present = t.attendances.filter((a) => a.status === "PRESENT").length;
      const absent = t.attendances.filter((a) => a.status === "ABSENT").length;
      const pending = t.attendances.filter((a) => a.status === "PENDING").length;
      const total = t.attendances.length;

      byTypeMap[type].present += present;
      byTypeMap[type].absent += absent;
      byTypeMap[type].pending += pending;
      byTypeMap[type].total += total;
      byTypeMap[type].count += 1;

      const day = new Date(t.date).getUTCDay();
      const dayType = day === 0 || day === 6 ? "weekend" : "weekday";
      byDayTypeMap[dayType].present += present;
      byDayTypeMap[dayType].absent += absent;
      byDayTypeMap[dayType].pending += pending;
      byDayTypeMap[dayType].total += total;
      byDayTypeMap[dayType].count += 1;
    }

    const byType = Object.entries(byTypeMap).map(([type, data]) => ({
      type,
      ...data,
      rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
    }));

    const byDayType = Object.entries(byDayTypeMap)
      .filter(([, data]) => data.count > 0)
      .map(([dayType, data]) => ({
        dayType,
        label: dayType === "weekday" ? "평일" : "주말",
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
      }));

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

    return {
      batchId: batch.id,
      batchName: batch.name,
      status: batch.status,
      startDate: batch.startDate,
      endDate: batch.endDate,
      totalUsers,
      totalTrainings: trainings.length,
      summary: {
        present: totalPresent,
        absent: totalAbsent,
        pending: totalPending,
        total: totalAttendances,
        rate: totalAttendances > 0 ? Math.round((totalPresent / totalAttendances) * 100) : 0,
      },
      byType,
      byDayType,
      byUser,
    };
  });

  return json(result);
}
