import { prisma } from "@/lib/prisma";
import { getSession, json, unauthorized, badRequest } from "@/lib/api-utils";
import { put, del } from "@vercel/blob";
import { NextRequest } from "next/server";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;

  if (!file) return badRequest("사진 파일이 필요합니다.");
  if (!ALLOWED_TYPES.includes(file.type)) {
    return badRequest("JPG, PNG, WebP 형식만 업로드 가능합니다.");
  }
  if (file.size > MAX_SIZE) {
    return badRequest("파일 크기는 5MB 이하여야 합니다.");
  }

  // 기존 pending 사진 삭제
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { pendingPhotoUrl: true },
  });

  if (user?.pendingPhotoUrl) {
    try {
      await del(user.pendingPhotoUrl);
    } catch {
      // Blob 삭제 실패해도 계속 진행
    }
  }

  // Vercel Blob 업로드
  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const filename = `profile/${session.user.id}-${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
  });

  // pendingPhotoUrl 저장 + 반려 상태 초기화
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      pendingPhotoUrl: blob.url,
      photoRejectedAt: null,
      photoRejectReason: null,
    },
  });

  return json({ pendingPhotoUrl: blob.url }, 201);
}
