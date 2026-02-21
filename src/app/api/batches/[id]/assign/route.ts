import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  if (!body.userIds || !Array.isArray(body.userIds) || body.userIds.length === 0) {
    return badRequest("userIds 배열이 필요합니다.");
  }

  await prisma.user.updateMany({
    where: { id: { in: body.userIds } },
    data: { batchId: id },
  });

  return json({ success: true, count: body.userIds.length });
}
