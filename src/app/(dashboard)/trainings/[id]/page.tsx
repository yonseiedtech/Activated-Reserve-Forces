import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/constants";
import PageTitle from "@/components/ui/PageTitle";
import Link from "next/link";
import SelfAttendanceForm from "@/components/attendance/SelfAttendanceForm";

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { id } = await params;
  const training = await prisma.training.findUnique({
    where: { id },
    include: {
      batch: true,
      instructor: { select: { name: true } },
      attendances: {
        include: { user: { select: { id: true, name: true, rank: true, serviceNumber: true } } },
        orderBy: { user: { name: "asc" } },
      },
    },
  });

  if (!training) return notFound();

  const isAdmin = ["ADMIN", "MANAGER"].includes(session.user.role);
  const isReservist = session.user.role === "RESERVIST";
  const date = new Date(training.date);
  const dateStr = date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  // RESERVIST 본인의 출석 기록
  const myAttendance = isReservist
    ? training.attendances.find((a) => a.user.id === session.user.id)
    : null;

  return (
    <div className="max-w-3xl">
      <PageTitle
        title={training.title}
        actions={
          isAdmin ? (
            <Link
              href={`/attendance/${training.id}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              출석 관리
            </Link>
          ) : undefined
        }
      />

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <InfoRow label="차수" value={training.batch.name} />
          <InfoRow label="유형" value={training.type} />
          <InfoRow label="날짜" value={dateStr} />
          <InfoRow label="시간" value={`${training.startTime || "-"} ~ ${training.endTime || "-"}`} />
          <InfoRow label="장소" value={training.location || "-"} />
          <InfoRow label="교관" value={training.instructor?.name || "-"} />
        </div>

        {training.description && (
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-2">훈련 내용</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{training.description}</p>
          </div>
        )}
      </div>

      {/* RESERVIST 자가 참석 관리 */}
      {isReservist && (
        <div className="mt-4">
          <SelfAttendanceForm
            trainingId={training.id}
            initialStatus={myAttendance?.status}
            initialReason={myAttendance?.reason || ""}
            initialExpectedConfirmAt={
              myAttendance?.expectedConfirmAt
                ? new Date(myAttendance.expectedConfirmAt).toISOString().slice(0, 16)
                : ""
            }
            initialEarlyLeaveTime={myAttendance?.earlyLeaveTime || ""}
          />
        </div>
      )}

      {/* 출석 현황 (관리자만) */}
      {isAdmin && training.attendances.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">출석 현황</h3>
          <div className="space-y-2">
            {training.attendances.map((att) => (
              <div key={att.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                <span>{att.user.rank} {att.user.name} ({att.user.serviceNumber})</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  att.status === "PRESENT" ? "bg-green-100 text-green-700" :
                  att.status === "ABSENT" ? "bg-red-100 text-red-700" :
                  "bg-gray-100 text-gray-600"
                }`}>
                  {ATTENDANCE_STATUS_LABELS[att.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-gray-500 text-xs mb-0.5">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
