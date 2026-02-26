import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest, forbidden } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  // mustChangePassword가 true인 사용자만 허용
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { mustChangePassword: true },
  });

  if (!user || !user.mustChangePassword) {
    return forbidden();
  }

  const { newPassword } = await req.json();

  if (!newPassword || newPassword.length < 6) {
    return badRequest("새 비밀번호는 6자 이상이어야 합니다.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed, mustChangePassword: false },
  });

  return json({ success: true });
}
