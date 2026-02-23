import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { del } from "@vercel/blob";
import { NextRequest } from "next/server";

// 사진 승인 대기 목록 (관리자용)
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const users = await prisma.user.findMany({
    where: { pendingPhotoUrl: { not: null } },
    select: {
      id: true,
      name: true,
      rank: true,
      serviceNumber: true,
      unit: true,
      photoUrl: true,
      pendingPhotoUrl: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return json(users);
}

// 사진 승인/반려
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { userId, action, rejectReason } = body as {
    userId: string;
    action: "approve" | "reject";
    rejectReason?: string;
  };

  if (!userId || !action) return badRequest("userId와 action이 필요합니다.");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { photoUrl: true, pendingPhotoUrl: true },
  });

  if (!user) return badRequest("사용자를 찾을 수 없습니다.");
  if (!user.pendingPhotoUrl) return badRequest("승인 대기 중인 사진이 없습니다.");

  if (action === "approve") {
    // 기존 승인 사진 삭제
    if (user.photoUrl) {
      try {
        await del(user.photoUrl);
      } catch {
        // 삭제 실패해도 계속
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        photoUrl: user.pendingPhotoUrl,
        pendingPhotoUrl: null,
        photoRejectedAt: null,
        photoRejectReason: null,
      },
    });

    return json({ success: true, action: "approved" });
  } else if (action === "reject") {
    // 대기 사진 Blob 삭제
    try {
      await del(user.pendingPhotoUrl);
    } catch {
      // 삭제 실패해도 계속
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        pendingPhotoUrl: null,
        photoRejectedAt: new Date(),
        photoRejectReason: rejectReason || "사유 미기재",
      },
    });

    return json({ success: true, action: "rejected" });
  }

  return badRequest("유효하지 않은 action입니다.");
}
