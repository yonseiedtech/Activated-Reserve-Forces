import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRAINING_TYPES } from "@/lib/constants";

// GET: 카테고리 목록 (없으면 기본값 자동 생성)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json([], { status: 401 });

  let categories = await prisma.trainingCategory.findMany({
    orderBy: { order: "asc" },
  });

  if (categories.length === 0) {
    await prisma.trainingCategory.createMany({
      data: TRAINING_TYPES.map((name, idx) => ({ name, order: idx })),
      skipDuplicates: true,
    });
    categories = await prisma.trainingCategory.findMany({
      orderBy: { order: "asc" },
    });
  }

  return NextResponse.json(categories);
}

// POST: 카테고리 추가 (ADMIN만)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { name, order } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "카테고리명을 입력하세요." }, { status: 400 });
  }

  const existing = await prisma.trainingCategory.findUnique({ where: { name: name.trim() } });
  if (existing) {
    return NextResponse.json({ error: "이미 존재하는 카테고리입니다." }, { status: 409 });
  }

  const maxOrder = await prisma.trainingCategory.aggregate({ _max: { order: true } });
  const newOrder = order ?? ((maxOrder._max.order ?? -1) + 1);

  const category = await prisma.trainingCategory.create({
    data: { name: name.trim(), order: newOrder },
  });

  return NextResponse.json(category, { status: 201 });
}
