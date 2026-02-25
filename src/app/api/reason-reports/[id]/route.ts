import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, notFound } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET: 개별 사유서 조회
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const report = await prisma.reasonReport.findUnique({
    where: { id },
    include: {
      batchUser: {
        include: {
          user: { select: { id: true, name: true, rank: true, serviceNumber: true, unit: true, branch: true } },
          batch: { select: { id: true, name: true, startDate: true, endDate: true } },
        },
      },
    },
  });

  if (!report) return notFound("사유서를 찾을 수 없습니다.");

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);
  if (!isAdmin && report.batchUser.userId !== session.user.id) return forbidden();

  return json(report);
}

// DELETE: 사유서 삭제
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const report = await prisma.reasonReport.findUnique({
    where: { id },
    include: { batchUser: true },
  });

  if (!report) return notFound("사유서를 찾을 수 없습니다.");

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);
  if (!isAdmin && report.batchUser.userId !== session.user.id) return forbidden();

  await prisma.reasonReport.delete({ where: { id } });
  return json({ success: true });
}
