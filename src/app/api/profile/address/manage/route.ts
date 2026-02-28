import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { notifyUsers } from "@/lib/push";

// 주소 변경 승인 대기 목록 (관리자용)
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const users = await prisma.user.findMany({
    where: { pendingAddress: { not: null } },
    select: {
      id: true,
      name: true,
      rank: true,
      serviceNumber: true,
      unit: true,
      zipCode: true,
      address: true,
      addressDetail: true,
      pendingZipCode: true,
      pendingAddress: true,
      pendingAddressDetail: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return json(users);
}

// 주소 변경 승인/반려
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
    select: {
      name: true,
      pendingZipCode: true,
      pendingAddress: true,
      pendingAddressDetail: true,
    },
  });

  if (!user) return badRequest("사용자를 찾을 수 없습니다.");
  if (!user.pendingAddress) return badRequest("승인 대기 중인 주소 변경이 없습니다.");

  if (action === "approve") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        zipCode: user.pendingZipCode,
        address: user.pendingAddress,
        addressDetail: user.pendingAddressDetail,
        pendingZipCode: null,
        pendingAddress: null,
        pendingAddressDetail: null,
        addressRejectedAt: null,
        addressRejectReason: null,
      },
    });

    // 사용자에게 승인 알림+푸시
    await notifyUsers(
      [userId],
      { title: "주소 변경 승인", content: "요청하신 주소 변경이 승인되었습니다." },
      { url: "/profile" }
    );

    return json({ success: true, action: "approved" });
  } else if (action === "reject") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        pendingZipCode: null,
        pendingAddress: null,
        pendingAddressDetail: null,
        addressRejectedAt: new Date(),
        addressRejectReason: rejectReason || "사유 미기재",
      },
    });

    // 사용자에게 반려 알림+푸시
    await notifyUsers(
      [userId],
      { title: "주소 변경 반려", content: `주소 변경이 반려되었습니다. 사유: ${rejectReason || "사유 미기재"}` },
      { url: "/profile" }
    );

    return json({ success: true, action: "rejected" });
  }

  return badRequest("유효하지 않은 action입니다.");
}
