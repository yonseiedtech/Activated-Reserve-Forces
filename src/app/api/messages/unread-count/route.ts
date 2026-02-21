import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized } from "@/lib/api-utils";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const count = await prisma.message.count({
    where: { receiverId: session.user.id, isRead: false },
  });

  return json({ count });
}
