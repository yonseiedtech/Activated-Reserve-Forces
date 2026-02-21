import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  const body = await req.json();
  const location = await prisma.gpsLocation.update({
    where: { id },
    data: {
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      radius: body.radius,
      isActive: body.isActive,
    },
  });

  return json(location);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;
  await prisma.gpsLocation.delete({ where: { id } });
  return json({ success: true });
}
