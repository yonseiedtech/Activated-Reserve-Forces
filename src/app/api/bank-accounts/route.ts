import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() || "";
  const filter = searchParams.get("filter"); // "registered" | "unregistered"

  const conditions: Prisma.UserWhereInput[] = [{ role: "RESERVIST" }];

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search } },
        { serviceNumber: { contains: search } },
      ],
    });
  }

  if (filter === "registered") {
    conditions.push({ bankName: { not: null } }, { bankAccount: { not: null } });
  } else if (filter === "unregistered") {
    conditions.push({ OR: [{ bankName: null }, { bankAccount: null }] });
  }

  const users = await prisma.user.findMany({
    where: { AND: conditions },
    select: {
      id: true,
      name: true,
      rank: true,
      serviceNumber: true,
      unit: true,
      bankName: true,
      bankAccount: true,
      phone: true,
    },
    orderBy: { name: "asc" },
  });

  return json(users);
}
