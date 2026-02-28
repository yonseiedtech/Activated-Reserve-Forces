import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// VAPID 설정 (lazy 초기화 — 빌드 시 환경변수 누락 방지)
let vapidInitialized = false;

function ensureVapid(): boolean {
  if (vapidInitialized) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY || "";
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails("mailto:admin@active-duty-reserve.vercel.app", publicKey, privateKey);
    vapidInitialized = true;
    return true;
  } catch {
    return false;
  }
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** 특정 유저들의 모든 구독에 웹 푸시 전송 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload) {
  if (!ensureVapid()) return;
  if (userIds.length === 0) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 410 Gone 또는 404: 구독 만료 → 삭제
        if (statusCode === 410 || statusCode === 404) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}

/** 역할 기반 푸시 전송 */
export async function sendPushToRole(roles: string[], payload: PushPayload) {
  const users = await prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true },
  });
  if (users.length === 0) return;
  await sendPushToUsers(users.map((u) => u.id), payload);
}

/** 인앱 알림 생성 + 웹 푸시 동시 발송 (통합 함수) */
export async function notifyUsers(
  userIds: string[],
  notification: { title: string; content: string; type?: string },
  pushOptions?: { url?: string; tag?: string }
) {
  if (userIds.length === 0) return;

  // 1. 인앱 알림 생성 (항상 보장)
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: notification.title,
      content: notification.content,
      type: notification.type || "GENERAL",
    })),
  });

  // 2. 웹 푸시 (실패해도 인앱 알림에 영향 없음)
  try {
    await sendPushToUsers(userIds, {
      title: notification.title,
      body: notification.content,
      url: pushOptions?.url,
      tag: pushOptions?.tag,
    });
  } catch {
    // 푸시 실패는 무시
  }
}
