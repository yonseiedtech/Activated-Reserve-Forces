import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const notices = await prisma.notice.findMany({
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
  });

  return json(notices);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();
  const notice = await prisma.notice.create({
    data: {
      title: body.title,
      content: body.content,
      isPinned: body.isPinned || false,
      filePath: body.filePath,
      authorId: session.user.id,
    },
  });

  return json(notice, 201);
}
