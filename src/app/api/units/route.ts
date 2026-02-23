import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const units = await prisma.unit.findMany({
    orderBy: { name: "asc" },
  });

  return json(units);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const body = await req.json();
  const unit = await prisma.unit.create({
    data: {
      name: body.name,
      description: body.description || null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      address: body.address || null,
    },
  });

  return json(unit, 201);
}
