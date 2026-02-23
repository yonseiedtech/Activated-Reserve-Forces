import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// 내 프로필 조회
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      phone: true,
      rank: true,
      serviceNumber: true,
      unit: true,
      position: true,
      birthDate: true,
      branch: true,
      warBattalion: true,
      warCompany: true,
      warPlatoon: true,
      warPosition: true,
      photoUrl: true,
      pendingPhotoUrl: true,
      photoRejectedAt: true,
      photoRejectReason: true,
      zipCode: true,
      address: true,
      addressDetail: true,
      vehicleType: true,
      vehiclePlateNumber: true,
      vehicleColor: true,
      batchUsers: {
        select: { batch: { select: { name: true } } },
        orderBy: { createdAt: "desc" as const },
      },
    },
  });

  if (!user) return json(null);

  const { batchUsers, ...rest } = user;
  return json({
    ...rest,
    batches: batchUsers.map((bu) => bu.batch.name),
  });
}

// 내 프로필 수정 (허용 필드만)
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();

  const allowedFields = [
    "phone",
    "zipCode",
    "address",
    "addressDetail",
    "vehicleType",
    "vehiclePlateNumber",
    "vehicleColor",
  ] as const;

  const data: Record<string, string | null> = {};
  for (const key of allowedFields) {
    if (key in body) {
      const val = body[key];
      data[key] = typeof val === "string" && val.trim() !== "" ? val.trim() : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return badRequest("수정할 항목이 없습니다.");
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      phone: true,
      zipCode: true,
      address: true,
      addressDetail: true,
      vehicleType: true,
      vehiclePlateNumber: true,
      vehicleColor: true,
    },
  });

  return json(updated);
}
