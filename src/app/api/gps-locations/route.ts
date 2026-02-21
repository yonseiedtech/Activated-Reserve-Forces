import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const locations = await prisma.gpsLocation.findMany({ orderBy: { createdAt: "desc" } });
  return json(locations);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const body = await req.json();
  const location = await prisma.gpsLocation.create({
    data: {
      name: body.name,
      latitude: body.latitude,
      longitude: body.longitude,
      radius: body.radius || 200,
    },
  });

  return json(location, 201);
}
