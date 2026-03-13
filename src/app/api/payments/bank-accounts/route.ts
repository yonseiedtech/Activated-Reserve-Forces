import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { searchParams } = req.nextUrl;
  const batchId = searchParams.get("batchId");

  if (!batchId) return badRequest("batchId가 필요합니다.");

  const batch = await prisma.batch.findUnique({
    where: { id: batchId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      batchUsers: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              rank: true,
              serviceNumber: true,
              unit: true,
              birthDate: true,
              bankName: true,
              bankAccount: true,
            },
          },
        },
      },
    },
  });

  if (!batch) return json({ error: "차수를 찾을 수 없습니다." }, 404);

  const users = batch.batchUsers.map((bu) => ({
    id: bu.user.id,
    name: bu.user.name,
    rank: bu.user.rank,
    serviceNumber: bu.user.serviceNumber,
    unit: bu.user.unit,
    birthDate: bu.user.birthDate,
    bankName: bu.user.bankName,
    bankAccount: bu.user.bankAccount,
  }));

  return json({
    batchId: batch.id,
    batchName: batch.name,
    startDate: batch.startDate,
    endDate: batch.endDate,
    users,
  });
}
