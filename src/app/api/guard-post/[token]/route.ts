import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// 공개 API: 토큰 검증 + 차수/대상자 정보 반환
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const guardToken = await prisma.guardPostToken.findUnique({
    where: { token },
    include: {
      batch: {
        include: {
          batchUsers: {
            include: {
              user: { select: { id: true, name: true, rank: true, serviceNumber: true } },
            },
          },
        },
      },
    },
  });

  if (!guardToken) {
    return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
  }

  if (!guardToken.isActive) {
    return NextResponse.json({ error: "비활성화된 링크입니다." }, { status: 403 });
  }

  if (guardToken.expiresAt && new Date() > guardToken.expiresAt) {
    return NextResponse.json({ error: "만료된 링크입니다." }, { status: 403 });
  }

  // 오늘 날짜 (KST)
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const todayStr = kst.toISOString().split("T")[0];
  const today = new Date(todayStr + "T00:00:00.000Z");

  const userIds = guardToken.batch.batchUsers.map((bu) => bu.user.id);
  const existingRecords = await prisma.commutingRecord.findMany({
    where: {
      userId: { in: userIds },
      date: today,
    },
  });

  const recordMap: Record<string, { checkInAt: string | null; checkOutAt: string | null }> = {};
  for (const r of existingRecords) {
    recordMap[r.userId] = {
      checkInAt: r.checkInAt?.toISOString() || null,
      checkOutAt: r.checkOutAt?.toISOString() || null,
    };
  }

  return NextResponse.json({
    batchName: guardToken.batch.name,
    batchId: guardToken.batch.id,
    startDate: guardToken.batch.startDate,
    endDate: guardToken.batch.endDate,
    label: guardToken.label,
    users: guardToken.batch.batchUsers.map((bu) => ({
      userId: bu.user.id,
      name: bu.user.name,
      rank: bu.user.rank,
      serviceNumber: bu.user.serviceNumber,
      checkInAt: recordMap[bu.user.id]?.checkInAt || null,
      checkOutAt: recordMap[bu.user.id]?.checkOutAt || null,
    })),
  });
}
