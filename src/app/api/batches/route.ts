import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const batches = await prisma.batch.findMany({
    orderBy: { startDate: "desc" },
    include: { _count: { select: { users: true, trainings: true } } },
  });

  return json(batches);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const batch = await prisma.batch.create({
    data: {
      name: body.name,
      year: body.year,
      number: body.number,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      status: body.status || "PLANNED",
    },
  });

  return json(batch, 201);
}
