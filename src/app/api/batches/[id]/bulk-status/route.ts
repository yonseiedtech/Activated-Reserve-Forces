import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  if (!body.batchUserIds || !Array.isArray(body.batchUserIds) || body.batchUserIds.length === 0) {
    return badRequest("batchUserIds 배열이 필요합니다.");
  }
  if (body.status !== "ABSENT") {
    return badRequest("현재 ABSENT 상태만 지원합니다.");
  }

  const result = await prisma.batchUser.updateMany({
    where: {
      id: { in: body.batchUserIds },
      batchId: id,
    },
    data: {
      status: body.status,
    },
  });

  return json({ success: true, count: result.count });
}
