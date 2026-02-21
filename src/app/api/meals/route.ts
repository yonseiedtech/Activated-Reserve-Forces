import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const batchId = searchParams.get("batchId");
  const date = searchParams.get("date");

  const where: Record<string, unknown> = {};
  if (batchId) where.batchId = batchId;
  if (date) where.date = new Date(date);

  const meals = await prisma.meal.findMany({
    where,
    include: { batch: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { type: "asc" }],
  });

  return json(meals);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER", "COOK"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const meal = await prisma.meal.upsert({
    where: {
      batchId_date_type: {
        batchId: body.batchId,
        date: new Date(body.date),
        type: body.type,
      },
    },
    create: {
      batchId: body.batchId,
      date: new Date(body.date),
      type: body.type,
      menuInfo: body.menuInfo,
      menuFile: body.menuFile,
      headcount: body.headcount || 0,
    },
    update: {
      menuInfo: body.menuInfo,
      menuFile: body.menuFile,
      headcount: body.headcount,
    },
  });

  return json(meal);
}
