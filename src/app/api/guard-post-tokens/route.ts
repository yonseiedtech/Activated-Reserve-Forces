import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import crypto from "crypto";

// 토큰 목록 조회
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const batchId = new URL(req.url).searchParams.get("batchId");
  if (!batchId) return badRequest("batchId가 필요합니다.");

  const tokens = await prisma.guardPostToken.findMany({
    where: { batchId },
    orderBy: { createdAt: "desc" },
  });
  return json(tokens);
}

// 새 토큰 생성
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { batchId, label, expiresAt: customExpiresAt, noExpiry } = await req.json();
  if (!batchId) return badRequest("batchId가 필요합니다.");

  const batch = await prisma.batch.findUnique({ where: { id: batchId } });
  if (!batch) return badRequest("차수를 찾을 수 없습니다.");

  const token = crypto.randomBytes(32).toString("hex");

  // 만료일 결정: 무기한 > 직접 지정 > 차수 종료일(KST 23:59:59)
  let expiresAt: Date | null = null;
  if (noExpiry) {
    expiresAt = null;
  } else if (customExpiresAt) {
    expiresAt = new Date(customExpiresAt);
  } else {
    // 차수 종료일 KST 23:59:59 (= UTC 14:59:59)
    const endStr = batch.endDate.toISOString().split("T")[0];
    expiresAt = new Date(endStr + "T14:59:59.000Z");
  }

  const guardPostToken = await prisma.guardPostToken.create({
    data: {
      batchId,
      token,
      label: label || null,
      expiresAt,
      createdBy: session.user.id,
    },
  });

  return json(guardPostToken, 201);
}
