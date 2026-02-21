import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
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
  const body = await req.json();
  const { newPassword } = body;

  if (!newPassword || newPassword.length < 4) {
    return badRequest("비밀번호는 4자 이상이어야 합니다.");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  });

  return json({ message: "비밀번호가 초기화되었습니다." });
}
