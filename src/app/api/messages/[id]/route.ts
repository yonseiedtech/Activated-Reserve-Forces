import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const message = await prisma.message.findUnique({
    where: { id },
    include: {
      sender: { select: { id: true, name: true, rank: true } },
      receiver: { select: { id: true, name: true, rank: true } },
    },
  });

  // 읽음 처리
  if (message && message.receiverId === session.user.id && !message.isRead) {
    await prisma.message.update({ where: { id }, data: { isRead: true } });
  }

  return json(message);
}
