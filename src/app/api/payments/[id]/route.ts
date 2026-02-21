import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { PAYMENT_STATUS_ORDER } from "@/lib/constants";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  // 상태 진행 (다음 단계로)
  if (body.action === "advance") {
    const current = await prisma.paymentProcess.findUnique({ where: { id } });
    if (!current) return notFound();

    const currentIndex = PAYMENT_STATUS_ORDER.indexOf(current.status as typeof PAYMENT_STATUS_ORDER[number]);
    if (currentIndex >= PAYMENT_STATUS_ORDER.length - 1) {
      return badRequest("이미 최종 단계입니다.");
    }

    const nextStatus = PAYMENT_STATUS_ORDER[currentIndex + 1];
    const dateFieldMap: Record<string, Record<string, Date>> = {
      DOC_DRAFT: { docDraftAt: new Date() },
      DOC_APPROVED: { docApprovedAt: new Date() },
      CMS_DRAFT: { cmsDraftAt: new Date() },
      CMS_APPROVED: { cmsApprovedAt: new Date() },
    };
    const dateField = dateFieldMap[nextStatus] || {};

    const updated = await prisma.paymentProcess.update({
      where: { id },
      data: { status: nextStatus, ...dateField },
    });

    return json(updated);
  }

  // 상태 되돌리기 (이전 단계로)
  if (body.action === "revert") {
    const current = await prisma.paymentProcess.findUnique({ where: { id } });
    if (!current) return notFound();

    const currentIndex = PAYMENT_STATUS_ORDER.indexOf(current.status as typeof PAYMENT_STATUS_ORDER[number]);
    if (currentIndex <= 0) {
      return badRequest("이미 첫 번째 단계입니다.");
    }

    const prevStatus = PAYMENT_STATUS_ORDER[currentIndex - 1];
    // 현재 단계의 타임스탬프 null 처리
    const clearFieldMap: Record<string, Record<string, null>> = {
      DOC_APPROVED: { docApprovedAt: null },
      CMS_DRAFT: { cmsDraftAt: null },
      CMS_APPROVED: { cmsApprovedAt: null },
    };
    const clearField = clearFieldMap[current.status] || {};

    const updated = await prisma.paymentProcess.update({
      where: { id },
      data: { status: prevStatus, ...clearField },
    });

    return json(updated);
  }

  // 일반 수정 (bankInfo, note)
  const updated = await prisma.paymentProcess.update({
    where: { id },
    data: {
      bankInfo: body.bankInfo,
      note: body.note,
    },
  });

  return json(updated);
}
