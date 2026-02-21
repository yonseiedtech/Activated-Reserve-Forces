import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return notFound("사용자를 찾을 수 없습니다.");

  // username unique 체크
  if (body.username !== undefined && body.username !== existing.username) {
    const dup = await prisma.user.findUnique({ where: { username: body.username } });
    if (dup) return badRequest("이미 사용 중인 아이디입니다.");
  }

  // uniqueNumber unique 체크
  if (body.uniqueNumber !== undefined && body.uniqueNumber && body.uniqueNumber !== existing.uniqueNumber) {
    const dup = await prisma.user.findFirst({ where: { uniqueNumber: body.uniqueNumber } });
    if (dup) return badRequest("이미 사용 중인 고유번호입니다.");
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      username: body.username !== undefined ? body.username : undefined,
      name: body.name !== undefined ? body.name : undefined,
      uniqueNumber: body.uniqueNumber !== undefined ? (body.uniqueNumber || null) : undefined,
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
      uniqueNumber: true,
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

  // MobileIdCard 연동: uniqueNumber 변경 시 동기화
  if (body.uniqueNumber !== undefined) {
    const card = await prisma.mobileIdCard.findUnique({ where: { userId: id } });
    if (card && body.uniqueNumber) {
      await prisma.mobileIdCard.update({
        where: { userId: id },
        data: { uniqueNumber: body.uniqueNumber },
      });
    }
  }

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
      uniqueNumber: true,
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
