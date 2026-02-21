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
      birthDate: body.birthDate !== undefined ? (body.birthDate ? new Date(body.birthDate) : null) : undefined,
      branch: body.branch !== undefined ? (body.branch || null) : undefined,
      warBattalion: body.warBattalion !== undefined ? (body.warBattalion || null) : undefined,
      warCompany: body.warCompany !== undefined ? (body.warCompany || null) : undefined,
      warPlatoon: body.warPlatoon !== undefined ? (body.warPlatoon || null) : undefined,
      warPosition: body.warPosition !== undefined ? (body.warPosition || null) : undefined,
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
      birthDate: true,
      branch: true,
      warBattalion: true,
      warCompany: true,
      warPlatoon: true,
      warPosition: true,
      batchUsers: {
        select: { batch: { select: { id: true, name: true } } },
      },
    },
  });

  // Handle batchId update (single batch assignment via edit modal)
  if (body.batchId !== undefined) {
    await prisma.batchUser.deleteMany({ where: { userId: id } });
    if (body.batchId) {
      await prisma.batchUser.create({
        data: { userId: id, batchId: body.batchId },
      });
    }
  }

  // Handle batchIds array (multiple batch assignment)
  if (body.batchIds !== undefined && Array.isArray(body.batchIds)) {
    await prisma.batchUser.deleteMany({ where: { userId: id } });
    if (body.batchIds.length > 0) {
      await prisma.batchUser.createMany({
        data: body.batchIds.map((bId: string) => ({ userId: id, batchId: bId })),
        skipDuplicates: true,
      });
    }
  }

  // Re-fetch with updated batchUsers
  const updated = await prisma.user.findUnique({
    where: { id },
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
      birthDate: true,
      branch: true,
      warBattalion: true,
      warCompany: true,
      warPlatoon: true,
      warPosition: true,
      batchUsers: {
        select: { batch: { select: { id: true, name: true } } },
      },
    },
  });

  const { batchUsers, ...rest } = updated!;
  return json({
    ...rest,
    batches: batchUsers.map((bu) => bu.batch),
  });
}
