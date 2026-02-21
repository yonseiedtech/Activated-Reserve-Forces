import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PageTitle from "@/components/ui/PageTitle";
import { ROLE_LABELS } from "@/lib/constants";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      batchUsers: {
        select: { batch: { select: { name: true, startDate: true, endDate: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) return null;

  const batchNames = user.batchUsers.map((bu) => bu.batch.name).join(", ");
  const latestBatch = user.batchUsers[0]?.batch || null;

  const fields = [
    { label: "이름", value: user.name },
    { label: "역할", value: ROLE_LABELS[user.role] || user.role },
    { label: "계급", value: user.rank },
    { label: "군번", value: user.serviceNumber },
    { label: "소속부대", value: user.unit },
    { label: "소속 차수", value: batchNames || null },
    { label: "연락처", value: user.phone },
    { label: "생년월일", value: user.birthDate ? new Date(user.birthDate).toLocaleDateString("ko-KR") : null },
    { label: "아이디", value: user.username },
    { label: "병과", value: user.branch },
    { label: "전시부대(대대)", value: user.warBattalion },
    { label: "전시부대(중대)", value: user.warCompany },
    { label: "전시부대(소대)", value: user.warPlatoon },
    { label: "전시직책", value: user.warPosition },
  ];

  return (
    <div className="max-w-lg">
      <PageTitle title="내 정보" />

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="bg-blue-600 px-6 py-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">
            👤
          </div>
          <h2 className="text-xl font-bold">{user.rank ? `${user.rank} ` : ""}{user.name}</h2>
          <p className="text-blue-100 text-sm mt-1">{ROLE_LABELS[user.role] || user.role}</p>
        </div>

        <div className="divide-y">
          {fields.map((field) => (
            <div key={field.label} className="flex items-center px-6 py-3">
              <span className="text-sm text-gray-500 w-28 shrink-0">{field.label}</span>
              <span className="text-sm font-medium text-gray-900">{field.value || "-"}</span>
            </div>
          ))}
        </div>

        {latestBatch && (
          <div className="px-6 py-4 bg-gray-50 border-t">
            <p className="text-xs text-gray-500">
              최근 차수 기간: {new Date(latestBatch.startDate).toLocaleDateString("ko-KR")} ~ {new Date(latestBatch.endDate).toLocaleDateString("ko-KR")}
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        정보 수정이 필요한 경우 관리자에게 요청하세요.
      </p>
    </div>
  );
}
