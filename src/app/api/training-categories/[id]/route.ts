import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT: 카테고리 수정
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const { name, order } = await req.json();

  const existing = await prisma.trainingCategory.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 404 });
  }

  if (name && name.trim() !== existing.name) {
    const duplicate = await prisma.trainingCategory.findUnique({ where: { name: name.trim() } });
    if (duplicate) {
      return NextResponse.json({ error: "이미 존재하는 카테고리명입니다." }, { status: 409 });
    }
  }

  const updated = await prisma.trainingCategory.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(order !== undefined ? { order } : {}),
    },
  });

  return NextResponse.json(updated);
}

// DELETE: 카테고리 삭제
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const category = await prisma.trainingCategory.findUnique({ where: { id } });
  if (!category) {
    return NextResponse.json({ error: "카테고리를 찾을 수 없습니다." }, { status: 404 });
  }

  // 해당 카테고리를 사용 중인 훈련이 있는지 확인
  const usageCount = await prisma.training.count({ where: { type: category.name } });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: `이 카테고리를 사용 중인 훈련이 ${usageCount}개 있어 삭제할 수 없습니다.` },
      { status: 409 }
    );
  }

  await prisma.trainingCategory.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
