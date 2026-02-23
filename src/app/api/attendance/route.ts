import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// 일괄 출석 upsert
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER", "INSTRUCTOR"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { trainingId, records } = body as {
    trainingId: string;
    records: {
      userId: string;
      status: string;
      reason?: string;
      expectedConfirmAt?: string;
      earlyLeaveTime?: string;
    }[];
  };

  if (!trainingId || !records?.length) return badRequest("훈련ID와 출석 기록이 필요합니다.");

  const results = await Promise.all(
    records.map((r) =>
      prisma.attendance.upsert({
        where: { trainingId_userId: { trainingId, userId: r.userId } },
        create: {
          trainingId,
          userId: r.userId,
          status: r.status,
          reason: r.reason || null,
          expectedConfirmAt: r.expectedConfirmAt ? new Date(r.expectedConfirmAt) : null,
          earlyLeaveTime: r.earlyLeaveTime || null,
        },
        update: {
          status: r.status,
          reason: r.reason || null,
          expectedConfirmAt: r.expectedConfirmAt ? new Date(r.expectedConfirmAt) : null,
          earlyLeaveTime: r.earlyLeaveTime || null,
        },
      })
    )
  );

  return json(results);
}
