import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "received"; // received | sent

  const messages = type === "sent"
    ? await prisma.message.findMany({
        where: { senderId: session.user.id },
        include: { receiver: { select: { id: true, name: true, rank: true } } },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.message.findMany({
        where: { receiverId: session.user.id },
        include: { sender: { select: { id: true, name: true, rank: true } } },
        orderBy: { createdAt: "desc" },
      });

  return json(messages);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const body = await req.json();

  // 다수 수신자에게 발송
  const receiverIds: string[] = Array.isArray(body.receiverIds) ? body.receiverIds : [body.receiverId];

  const messages = await Promise.all(
    receiverIds.map((receiverId) =>
      prisma.message.create({
        data: {
          senderId: session.user.id,
          receiverId,
          title: body.title,
          content: body.content,
        },
      })
    )
  );

  return json(messages, 201);
}
