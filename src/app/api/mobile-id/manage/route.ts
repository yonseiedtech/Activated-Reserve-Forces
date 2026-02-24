import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// 전체 신분증 목록 (관리자용)
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const cards = await prisma.mobileIdCard.findMany({
    include: {
      user: {
        select: {
          name: true, rank: true, serviceNumber: true,
          unit: true, position: true, birthDate: true, photoUrl: true,
          batchUsers: {
            select: { batch: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      approvedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Transform batchUsers to batch for frontend compatibility
  const transformed = cards.map((card) => {
    const { batchUsers, ...userRest } = card.user;
    return {
      ...card,
      user: {
        ...userRest,
        batch: batchUsers[0]?.batch || null,
      },
    };
  });

  return json(transformed);
}

// 승인 / 반려
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { cardId, action, rejectReason, validFrom, validUntil, approvalNumber } = body as {
    cardId: string;
    action: "approve" | "reject";
    rejectReason?: string;
    validFrom?: string;
    validUntil?: string;
    approvalNumber?: string;
  };

  if (!cardId || !action) return badRequest("cardId와 action이 필요합니다.");

  const card = await prisma.mobileIdCard.findUnique({ where: { id: cardId } });
  if (!card) return badRequest("신분증을 찾을 수 없습니다.");

  if (action === "approve") {
    const updated = await prisma.mobileIdCard.update({
      where: { id: cardId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedById: session.user.id,
        rejectedAt: null,
        rejectReason: null,
        ...(validFrom ? { validFrom: new Date(validFrom) } : {}),
        ...(validUntil ? { validUntil: new Date(validUntil) } : {}),
        ...(approvalNumber ? { approvalNumber } : {}),
      },
    });
    return json(updated);
  } else if (action === "reject") {
    const updated = await prisma.mobileIdCard.update({
      where: { id: cardId },
      data: {
        isApproved: false,
        rejectedAt: new Date(),
        rejectReason: rejectReason || "사유 미기재",
        approvedAt: null,
        approvedById: null,
      },
    });
    return json(updated);
  }

  return badRequest("유효하지 않은 action입니다.");
}
