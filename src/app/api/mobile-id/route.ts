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
          unit: true, position: true, birthDate: true,
          batch: { select: { name: true, startDate: true, endDate: true } },
        },
      },
      approvedBy: { select: { name: true } },
    },
  });

  return json(card);
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

  // 사용자 정보 가져오기
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { batch: true },
  });
  if (!user?.batchId || !user.batch) return badRequest("차수 정보가 없습니다.");

  // 고유번호 생성: RES-{년도}-{순번5자리}
  const year = user.batch.year;
  const count = await prisma.mobileIdCard.count({
    where: { uniqueNumber: { startsWith: `RES-${year}-` } },
  });
  const uniqueNumber = `RES-${year}-${String(count + 1).padStart(5, "0")}`;

  const card = await prisma.mobileIdCard.create({
    data: {
      userId: session.user.id,
      uniqueNumber,
      validFrom: user.batch.startDate,
      validUntil: user.batch.endDate,
    },
  });

  return json(card, 201);
}
