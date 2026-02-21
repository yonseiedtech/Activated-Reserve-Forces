import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET: 차수별 환수 프로세스 조회 (없으면 자동 생성)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  if (!batchId) return badRequest("batchId가 필요합니다.");

  let refund = await prisma.refundProcess.findUnique({ where: { batchId } });

  if (!refund) {
    refund = await prisma.refundProcess.create({
      data: {
        batchId,
        status: "REFUND_REQUESTED",
      },
    });
  }

  return json(refund);
}

// POST: 환수 프로세스 생성 (명시적)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { batchId, reason, compensationRefund, transportRefund } = body;

  if (!batchId) return badRequest("batchId가 필요합니다.");

  const existing = await prisma.refundProcess.findUnique({ where: { batchId } });
  if (existing) return badRequest("이미 환수 프로세스가 존재합니다.");

  const refund = await prisma.refundProcess.create({
    data: {
      batchId,
      status: "REFUND_REQUESTED",
      reason: reason || null,
      compensationRefund: compensationRefund || 0,
      transportRefund: transportRefund || 0,
      refundRequestedAt: new Date(),
    },
  });

  return json(refund, 201);
}
