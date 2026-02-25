import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// 공개 API: 출퇴근 기록 입력
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const guardToken = await prisma.guardPostToken.findUnique({
    where: { token },
    include: { batch: true },
  });

  if (!guardToken || !guardToken.isActive) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 403 });
  }
  if (guardToken.expiresAt && new Date() > guardToken.expiresAt) {
    return NextResponse.json({ error: "만료된 링크입니다." }, { status: 403 });
  }

  const { userId, type } = await req.json();

  if (!userId || !["checkIn", "checkOut"].includes(type)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  // 해당 유저가 이 차수에 배정되어 있는지 확인
  const batchUser = await prisma.batchUser.findFirst({
    where: { userId, batchId: guardToken.batchId },
  });
  if (!batchUser) {
    return NextResponse.json({ error: "해당 차수에 배정되지 않은 대상자입니다." }, { status: 400 });
  }

  // 오늘 날짜 (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");

  const updateData = type === "checkIn"
    ? { checkInAt: now }
    : { checkOutAt: now };

  const record = await prisma.commutingRecord.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      date: today,
      batchId: guardToken.batchId,
      isManual: false,
      note: `위병소 입력 (${guardToken.label || "공유링크"})`,
      ...updateData,
    },
    update: updateData,
  });

  return NextResponse.json({
    success: true,
    checkInAt: record.checkInAt?.toISOString() || null,
    checkOutAt: record.checkOutAt?.toISOString() || null,
  });
}
