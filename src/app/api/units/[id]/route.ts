import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) return notFound("부대를 찾을 수 없습니다.");

  const unit = await prisma.unit.update({
    where: { id },
    data: {
      name: body.name,
      description: body.description ?? existing.description,
    },
  });

  return json(unit);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  await prisma.unit.delete({ where: { id } });
  return json({ success: true });
}
