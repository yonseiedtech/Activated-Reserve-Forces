import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const templates = await prisma.trainingTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return json(templates);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const body = await req.json();

  if (!body.name || !body.items || body.items.length === 0) {
    return badRequest("템플릿 이름과 최소 1개의 항목이 필요합니다.");
  }

  const template = await prisma.trainingTemplate.create({
    data: {
      name: body.name,
      description: body.description,
      items: {
        create: body.items.map((item: { title: string; type: string; startTime: string; endTime: string; location?: string; description?: string }, idx: number) => ({
          order: idx,
          title: item.title,
          type: item.type,
          startTime: item.startTime,
          endTime: item.endTime,
          location: item.location,
          description: item.description,
        })),
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return json(template, 201);
}
