import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET: 본인 알림 조회
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json(notifications);
}

// POST: 관리자가 알림/푸시 발송
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { title, content, type, targetRole, targetBatchId } = body;

  // 대상자 조회
  let userIds: string[] = [];
  if (targetBatchId) {
    const batchUserRecords = await prisma.batchUser.findMany({
      where: { batchId: targetBatchId },
      select: { userId: true },
    });
    userIds = batchUserRecords.map((bu) => bu.userId);
  }

  const where: Record<string, unknown> = {};
  if (targetRole) where.role = targetRole;
  if (targetBatchId) where.id = { in: userIds };

  const users = await prisma.user.findMany({
    where,
    select: { id: true },
  });

  // 인앱 알림 생성
  const notifications = await Promise.all(
    users.map((u) =>
      prisma.notification.create({
        data: { userId: u.id, title, content, type: type || "GENERAL" },
      })
    )
  );

  return json({ count: notifications.length, message: `${notifications.length}명에게 알림을 발송했습니다.` });
}
