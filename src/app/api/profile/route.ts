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
      pendingZipCode: true,
      pendingAddress: true,
      pendingAddressDetail: true,
      addressRejectedAt: true,
      addressRejectReason: true,
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
  const isReservist = session.user.role === "RESERVIST";

  // 주소 필드와 그 외 필드를 분리
  const addressFields = ["zipCode", "address", "addressDetail"] as const;
  const otherFields = ["phone", "vehicleType", "vehiclePlateNumber", "vehicleColor"] as const;

  const data: Record<string, string | null> = {};

  // 비-주소 필드는 그대로 업데이트
  for (const key of otherFields) {
    if (key in body) {
      const val = body[key];
      data[key] = typeof val === "string" && val.trim() !== "" ? val.trim() : null;
    }
  }

  // 주소 필드 처리
  const hasAddressChange = addressFields.some((k) => k in body);

  if (hasAddressChange && isReservist) {
    // RESERVIST: pending 필드에 저장
    const pendingMap: Record<string, string> = {
      zipCode: "pendingZipCode",
      address: "pendingAddress",
      addressDetail: "pendingAddressDetail",
    };
    for (const key of addressFields) {
      if (key in body) {
        const val = body[key];
        data[pendingMap[key]] = typeof val === "string" && val.trim() !== "" ? val.trim() : null;
      }
    }
    // 반려 상태 초기화
    data["addressRejectedAt" as string] = null;
    data["addressRejectReason" as string] = null;
  } else if (hasAddressChange) {
    // ADMIN/MANAGER: 직접 업데이트
    for (const key of addressFields) {
      if (key in body) {
        const val = body[key];
        data[key] = typeof val === "string" && val.trim() !== "" ? val.trim() : null;
      }
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
      pendingZipCode: true,
      pendingAddress: true,
      pendingAddressDetail: true,
      vehicleType: true,
      vehiclePlateNumber: true,
      vehicleColor: true,
    },
  });

  // RESERVIST 주소 변경 시 관리자에게 알림
  if (hasAddressChange && isReservist) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] } },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((a) => ({
          userId: a.id,
          title: "주소 변경 요청",
          content: `${session.user.name}님이 주소 변경을 요청했습니다.`,
          type: "GENERAL",
        })),
      });
    }
  }

  return json(updated);
}
