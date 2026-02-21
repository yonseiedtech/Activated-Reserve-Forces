import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// 교통비 일괄 저장 (관리자)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const { batchId, records } = body as {
    batchId: string;
    records: { userId: string; amount: number; address?: string; note?: string }[];
  };

  if (!batchId || !records?.length) return badRequest("batchId와 records가 필요합니다.");

  const results = await Promise.all(
    records.map((r) =>
      prisma.userTransportAllowance.upsert({
        where: { userId_batchId: { userId: r.userId, batchId } },
        create: { userId: r.userId, batchId, amount: r.amount, address: r.address, note: r.note },
        update: { amount: r.amount, address: r.address, note: r.note },
      })
    )
  );

  return json(results);
}
