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
      email: true,
      role: true,
      rank: true,
      serviceNumber: true,
      phone: true,
      unit: true,
      batchId: true,
      batch: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  return json(users);
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
      email: body.email,
      password: hashedPassword,
      role: body.role,
      rank: body.rank || null,
      serviceNumber: body.serviceNumber || null,
      phone: body.phone || null,
      unit: body.unit || null,
      batchId: body.batchId || null,
    },
  });

  return json({ id: user.id, name: user.name, email: user.email }, 201);
}
