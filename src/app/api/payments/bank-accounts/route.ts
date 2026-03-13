import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  // 훈련 대상자(RESERVIST) 전체의 계좌 정보
  const users = await prisma.user.findMany({
    where: { role: "RESERVIST" },
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
    orderBy: [{ unit: "asc" }, { name: "asc" }],
  });

  return json({ users });
}
