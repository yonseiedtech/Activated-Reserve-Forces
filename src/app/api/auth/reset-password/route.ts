import { prisma } from "@/lib/prisma";
import { json, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { userType, identifier, name, serviceNumber, phone, newPassword } = body;

  if (!identifier || !name || !newPassword) {
    return badRequest("필수 항목을 모두 입력해주세요.");
  }

  if (newPassword.length < 4) {
    return badRequest("비밀번호는 4자 이상이어야 합니다.");
  }

  // 사용자 열거 방지를 위한 동일 에러 메시지
  const genericError = "입력하신 정보와 일치하는 계정을 찾을 수 없습니다.";

  let user;
  if (userType === "reservist") {
    // 훈련대상자: 군번(identifier) + 이름 + 전화번호로 조회
    if (!phone) {
      return badRequest("전화번호를 입력해주세요.");
    }
    user = await prisma.user.findFirst({
      where: { serviceNumber: identifier, role: "RESERVIST" },
    });
  } else {
    // 관리자: 아이디(identifier) + 이름 + 군번/전화번호로 조회
    if (!serviceNumber && !phone) {
      return badRequest("군번 또는 전화번호 중 하나를 입력해주세요.");
    }
    user = await prisma.user.findFirst({
      where: { username: identifier, role: { not: "RESERVIST" } },
    });
  }

  if (!user || user.name !== name) {
    return json({ error: genericError }, 400);
  }

  // 본인 확인: 군번 또는 전화번호
  if (serviceNumber && user.serviceNumber !== serviceNumber) {
    return json({ error: genericError }, 400);
  }

  if (phone && user.phone !== phone) {
    return json({ error: genericError }, 400);
  }

  // 비밀번호 변경
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  return json({ message: "비밀번호가 변경되었습니다." });
}
