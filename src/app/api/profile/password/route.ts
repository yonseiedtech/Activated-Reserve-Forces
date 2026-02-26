import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return badRequest("현재 비밀번호와 새 비밀번호를 입력해주세요.");
  }

  if (newPassword.length < 6) {
    return badRequest("새 비밀번호는 6자 이상이어야 합니다.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user) return unauthorized();

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return badRequest("현재 비밀번호가 일치하지 않습니다.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  return json({ success: true });
}
