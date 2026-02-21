import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER", "COOK"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing) return notFound("식사 정보를 찾을 수 없습니다.");

  const meal = await prisma.meal.update({
    where: { id },
    data: {
      menuInfo: body.menuInfo,
      headcount: body.headcount,
    },
  });

  return json(meal);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER", "COOK"].includes(session.user.role)) return forbidden();

  const { id } = await params;

  const existing = await prisma.meal.findUnique({ where: { id } });
  if (!existing) return notFound("식사 정보를 찾을 수 없습니다.");

  await prisma.meal.delete({ where: { id } });
  return json({ success: true });
}
