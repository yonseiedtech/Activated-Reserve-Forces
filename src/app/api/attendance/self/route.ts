import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "RESERVIST") return forbidden();

  const body = await req.json();
  const { trainingId, status, reason, expectedConfirmAt, earlyLeaveTime } = body as {
    trainingId: string;
    status: string;
    reason?: string;
    expectedConfirmAt?: string;
    earlyLeaveTime?: string;
  };

  if (!trainingId || !status) return badRequest("trainingId와 status가 필요합니다.");
  if (!["PRESENT", "ABSENT", "PENDING"].includes(status)) return badRequest("유효하지 않은 상태입니다.");

  // 훈련이 본인 차수에 속하는지 검증
  const training = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!training) return badRequest("훈련을 찾을 수 없습니다.");

  const batchLink = await prisma.batchUser.findFirst({
    where: { userId: session.user.id, batchId: training.batchId },
  });
  if (!batchLink) return forbidden();

  // status별 필드 정리
  const data: {
    status: string;
    reason: string | null;
    expectedConfirmAt: Date | null;
    earlyLeaveTime: string | null;
  } = {
    status,
    reason: null,
    expectedConfirmAt: null,
    earlyLeaveTime: null,
  };

  if (status === "PRESENT") {
    data.earlyLeaveTime = earlyLeaveTime || null;
  } else if (status === "ABSENT") {
    data.reason = reason || null;
  } else if (status === "PENDING") {
    data.expectedConfirmAt = expectedConfirmAt ? new Date(expectedConfirmAt) : null;
  }

  const result = await prisma.attendance.upsert({
    where: { trainingId_userId: { trainingId, userId: session.user.id } },
    create: { trainingId, userId: session.user.id, ...data },
    update: data,
  });

  return json(result);
}
