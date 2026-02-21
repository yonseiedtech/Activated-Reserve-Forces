import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound("사용자를 찾을 수 없습니다.");

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: body.name !== undefined ? body.name : undefined,
      rank: body.rank !== undefined ? (body.rank || null) : undefined,
      serviceNumber: body.serviceNumber !== undefined ? (body.serviceNumber || null) : undefined,
      unit: body.unit !== undefined ? (body.unit || null) : undefined,
      phone: body.phone !== undefined ? (body.phone || null) : undefined,
      batchId: body.batchId !== undefined ? (body.batchId || null) : undefined,
      birthDate: body.birthDate !== undefined ? (body.birthDate ? new Date(body.birthDate) : null) : undefined,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      rank: true,
      serviceNumber: true,
      phone: true,
      unit: true,
      batchId: true,
      birthDate: true,
      batch: { select: { name: true } },
    },
  });

  return json(user);
}
