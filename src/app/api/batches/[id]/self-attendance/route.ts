import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, forbidden, badRequest } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { notifyUsers } from "@/lib/push";

// PATCH: 예비역 차수 참석 신고
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (session.user.role !== "RESERVIST") return forbidden();

  const { id: batchId } = await params;
  const body = await req.json();
  const { status, subStatus, reason, expectedConfirmAt, mobilizationCertIssued } = body as {
    status: string;
    subStatus?: string;
    reason?: string;
    expectedConfirmAt?: string;
    mobilizationCertIssued?: boolean;
  };

  if (!status) return badRequest("status가 필요합니다.");
  if (!["PRESENT", "ABSENT", "PENDING"].includes(status)) return badRequest("유효하지 않은 상태입니다.");
  if (subStatus && !["NORMAL", "LATE_ARRIVAL", "EARLY_DEPARTURE"].includes(subStatus)) return badRequest("유효하지 않은 세부 상태입니다.");

  // 본인이 해당 차수에 배정되어 있는지 확인
  const batchUser = await prisma.batchUser.findUnique({
    where: { userId_batchId: { userId: session.user.id, batchId } },
  });
  if (!batchUser) return forbidden();

  const data: { status: string; subStatus: string | null; reason: string | null; expectedConfirmAt: Date | null; mobilizationCertIssued?: boolean } = {
    status,
    subStatus: null,
    reason: null,
    expectedConfirmAt: null,
  };

  if (typeof mobilizationCertIssued === "boolean") {
    data.mobilizationCertIssued = mobilizationCertIssued;
  }

  if (status === "PRESENT") {
    data.subStatus = subStatus || "NORMAL";
  } else if (status === "ABSENT") {
    data.reason = reason || null;
  } else if (status === "PENDING") {
    data.expectedConfirmAt = expectedConfirmAt ? new Date(expectedConfirmAt) : null;
  }

  const result = await prisma.batchUser.update({
    where: { userId_batchId: { userId: session.user.id, batchId } },
    data,
    include: { batch: { select: { name: true } } },
  });

  // 관리자에게 참석신고 변경 알림+푸시
  const statusLabel = status === "PRESENT" ? "참석" : status === "ABSENT" ? "불참" : "보류";
  const subLabel = data.subStatus === "LATE_ARRIVAL" ? "(지각)" : data.subStatus === "EARLY_DEPARTURE" ? "(조퇴)" : status === "PRESENT" ? "(정상)" : "";

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
    select: { id: true },
  });
  if (admins.length > 0) {
    await notifyUsers(
      admins.map((a) => a.id),
      {
        title: "참석신고 변경",
        content: `${session.user.name}님이 ${result.batch.name} 참석 상태를 '${statusLabel}${subLabel}'(으)로 변경했습니다.`,
      },
      { url: `/admin/batches/${batchId}`, tag: `attendance-${batchId}` }
    );
  }

  return json(result);
}
