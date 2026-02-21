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

  // 일반 수정
  const updated = await prisma.paymentProcess.update({
    where: { id },
    data: {
      title: body.title,
      amount: body.amount,
      bankInfo: body.bankInfo,
      note: body.note,
    },
  });

  return json(updated);
}
