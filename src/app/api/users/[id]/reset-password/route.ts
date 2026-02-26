import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "ADMIN") return forbidden();

  const { id } = await params;

  const targetUser = await prisma.user.findUnique({
    where: { id },
    select: { role: true, birthDate: true },
  });

  if (!targetUser) return notFound("사용자를 찾을 수 없습니다.");

  let passwordToHash: string;

  if (targetUser.role === "RESERVIST" && targetUser.birthDate) {
    // RESERVIST이고 생년월일이 있으면 YYMMDD로 자동 설정
    const bd = targetUser.birthDate;
    const yy = String(bd.getFullYear()).slice(2);
    const mm = String(bd.getMonth() + 1).padStart(2, "0");
    const dd = String(bd.getDate()).padStart(2, "0");
    passwordToHash = `${yy}${mm}${dd}`;
  } else {
    // 그 외: body에서 newPassword 필수
    const body = await req.json();
    const { newPassword } = body;
    if (!newPassword || newPassword.length < 4) {
      return badRequest("비밀번호는 4자 이상이어야 합니다.");
    }
    passwordToHash = newPassword;
  }

  const hashedPassword = await bcrypt.hash(passwordToHash, 10);

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword, mustChangePassword: true },
  });

  return json({ message: "비밀번호가 초기화되었습니다." });
}
