import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const template = await prisma.trainingTemplate.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!template) return notFound("템플릿을 찾을 수 없습니다.");
  return json(template);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  const body = await req.json();

  if (!body.name || !body.items || body.items.length === 0) {
    return badRequest("템플릿 이름과 최소 1개의 항목이 필요합니다.");
  }

  // 기존 items 삭제 후 새로 생성
  await prisma.trainingTemplateItem.deleteMany({ where: { templateId: id } });

  const template = await prisma.trainingTemplate.update({
    where: { id },
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

  return json(template);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) return forbidden();

  const { id } = await params;
  await prisma.trainingTemplate.delete({ where: { id } });
  return json({ success: true });
}
