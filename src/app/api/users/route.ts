import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  const where = role ? { role } : {};

  const users = await prisma.user.findMany({
    where,
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
      zipCode: true,
      address: true,
      addressDetail: true,
      batchUsers: {
        select: { batch: { select: { id: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  // Transform batchUsers to batches for frontend compatibility
  const transformed = users.map((u) => {
    const { batchUsers, ...rest } = u;
    return {
      ...rest,
      batches: batchUsers.map((bu) => bu.batch),
    };
  });

  return json(transformed);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const body = await req.json();
  const hashedPassword = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.create({
    data: {
      name: body.name,
      username: body.username,
      email: body.email || null,
      password: hashedPassword,
      role: body.role,
      rank: body.rank || null,
      serviceNumber: body.serviceNumber || null,
      phone: body.phone || null,
      unit: body.unit || null,
      branch: body.branch || null,
      warBattalion: body.warBattalion || null,
      warCompany: body.warCompany || null,
      warPlatoon: body.warPlatoon || null,
      warPosition: body.warPosition || null,
    },
  });

  // batchId가 있으면 BatchUser로 연결
  if (body.batchId) {
    await prisma.batchUser.create({
      data: { userId: user.id, batchId: body.batchId },
    });
  }

  return json({ id: user.id, name: user.name, username: user.username }, 201);
}
