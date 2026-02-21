import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const notice = await prisma.notice.findUnique({ where: { id } });
  if (!notice) return notFound();
  return json(notice);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const body = await req.json();
  const notice = await prisma.notice.update({
    where: { id },
    data: { title: body.title, content: body.content, isPinned: body.isPinned },
  });
  return json(notice);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  await prisma.notice.delete({ where: { id } });
  return json({ success: true });
}
