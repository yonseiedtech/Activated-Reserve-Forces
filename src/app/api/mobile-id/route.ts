import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// 본인 신분증 조회
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const card = await prisma.mobileIdCard.findUnique({
    where: { userId: session.user.id },
    include: {
      user: {
        select: {
          name: true, rank: true, serviceNumber: true,
          unit: true, position: true, birthDate: true, photoUrl: true,
          batchUsers: {
            select: { batch: { select: { name: true, startDate: true, endDate: true } } },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      approvedBy: { select: { name: true } },
    },
  });

  if (!card) return json(null);

  // Transform batchUsers to batch for frontend compatibility
  const { batchUsers, ...userRest } = card.user;
  return json({
    ...card,
    user: {
      ...userRest,
      batch: batchUsers[0]?.batch || null,
    },
  });
}

// 신분증 발급 신청 (RESERVIST)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "RESERVIST") return forbidden();

  // 이미 발급된 카드가 있는지 확인
  const existing = await prisma.mobileIdCard.findUnique({
    where: { userId: session.user.id },
  });
  if (existing) return badRequest("이미 신분증이 발급(신청)되었습니다.");

  // 최신 차수 정보 가져오기
  const latestBatchUser = await prisma.batchUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { batch: true },
  });
  if (!latestBatchUser) return badRequest("차수 정보가 없습니다.");

  const batch = latestBatchUser.batch;

  // User.uniqueNumber가 있으면 그 값 사용, 없으면 자동생성
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { uniqueNumber: true } });
  let uniqueNumber = user?.uniqueNumber;

  if (!uniqueNumber) {
    const year = batch.year;
    const count = await prisma.mobileIdCard.count({
      where: { uniqueNumber: { startsWith: `RES-${year}-` } },
    });
    uniqueNumber = `RES-${year}-${String(count + 1).padStart(5, "0")}`;
  }

  const card = await prisma.mobileIdCard.create({
    data: {
      userId: session.user.id,
      uniqueNumber,
      validFrom: batch.startDate,
      validUntil: batch.endDate,
    },
  });

  return json(card, 201);
}
