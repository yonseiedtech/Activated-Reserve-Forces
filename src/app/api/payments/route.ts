import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");

  const where = batchId ? { batchId } : {};

  const payments = await prisma.paymentProcess.findMany({
    where,
    include: { batch: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return json(payments);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const payment = await prisma.paymentProcess.create({
    data: {
      batchId: body.batchId,
      title: body.title,
      amount: body.amount,
      bankInfo: body.bankInfo,
      status: "DOC_DRAFT",
      docDraftAt: new Date(),
      note: body.note,
    },
  });

  return json(payment, 201);
}
