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
  if (!["PRESENT", "ABSENT", "PENDING"].includes(body.status)) {
    return badRequest("유효하지 않은 상태입니다. (PRESENT, ABSENT, PENDING)");
  }

  const data: { status: string; subStatus?: string | null; reason?: string | null } = {
    status: body.status,
  };

  if (body.status === "PRESENT") {
    data.subStatus = body.subStatus || "NORMAL";
    data.reason = null;
  } else if (body.status === "ABSENT") {
    data.subStatus = null;
    data.reason = body.reason || null;
  } else {
    data.subStatus = null;
    data.reason = null;
  }

  const result = await prisma.batchUser.updateMany({
    where: {
      id: { in: body.batchUserIds },
      batchId: id,
    },
    data,
  });

  return json({ success: true, count: result.count });
}
