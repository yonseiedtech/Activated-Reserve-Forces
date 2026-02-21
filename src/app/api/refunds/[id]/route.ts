import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { REFUND_STATUS_ORDER } from "@/lib/constants";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  const current = await prisma.refundProcess.findUnique({ where: { id } });
  if (!current) return notFound("환수 프로세스를 찾을 수 없습니다.");

  // 다음 단계로
  if (body.action === "advance") {
    const currentIndex = REFUND_STATUS_ORDER.indexOf(current.status as typeof REFUND_STATUS_ORDER[number]);
    if (currentIndex >= REFUND_STATUS_ORDER.length - 1) {
      return badRequest("이미 최종 단계입니다.");
    }

    const nextStatus = REFUND_STATUS_ORDER[currentIndex + 1];
    const dateFieldMap: Record<string, Record<string, Date>> = {
      REFUND_REQUESTED: { refundRequestedAt: new Date() },
      DEPOSIT_CONFIRMED: { depositConfirmedAt: new Date() },
      REFUND_COMPLETED: { refundCompletedAt: new Date() },
    };
    const dateField = dateFieldMap[nextStatus] || {};

    const updated = await prisma.refundProcess.update({
      where: { id },
      data: { status: nextStatus, ...dateField },
    });
    return json(updated);
  }

  // 이전 단계로
  if (body.action === "revert") {
    const currentIndex = REFUND_STATUS_ORDER.indexOf(current.status as typeof REFUND_STATUS_ORDER[number]);
    if (currentIndex <= 0) {
      return badRequest("이미 첫 번째 단계입니다.");
    }

    const prevStatus = REFUND_STATUS_ORDER[currentIndex - 1];
    const clearFieldMap: Record<string, Record<string, null>> = {
      DEPOSIT_CONFIRMED: { depositConfirmedAt: null },
      REFUND_COMPLETED: { refundCompletedAt: null },
    };
    const clearField = clearFieldMap[current.status] || {};

    const updated = await prisma.refundProcess.update({
      where: { id },
      data: { status: prevStatus, ...clearField },
    });
    return json(updated);
  }

  // 일반 수정 (금액, 사유, 메모)
  const updated = await prisma.refundProcess.update({
    where: { id },
    data: {
      reason: body.reason !== undefined ? body.reason : undefined,
      compensationRefund: body.compensationRefund !== undefined ? body.compensationRefund : undefined,
      transportRefund: body.transportRefund !== undefined ? body.transportRefund : undefined,
      note: body.note !== undefined ? body.note : undefined,
    },
  });

  return json(updated);
}
