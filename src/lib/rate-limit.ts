import { prisma } from "./prisma";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15분

export async function checkRateLimit(identifier: string, _loginType?: string) {
  const windowStart = new Date(Date.now() - LOCK_DURATION_MS);

  // loginType 무관하게 identifier 기준으로 통합 카운팅 (우회 방지)
  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      identifier,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (failedAttempts >= MAX_ATTEMPTS) {
    const lastAttempt = await prisma.loginAttempt.findFirst({
      where: {
        identifier,
        success: false,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: "desc" },
    });

    const lockedUntil = lastAttempt
      ? new Date(lastAttempt.createdAt.getTime() + LOCK_DURATION_MS)
      : new Date(Date.now() + LOCK_DURATION_MS);

    if (lockedUntil > new Date()) {
      return {
        allowed: false,
        remainingAttempts: 0,
        lockedUntil,
      };
    }
  }

  return {
    allowed: true,
    remainingAttempts: MAX_ATTEMPTS - failedAttempts,
    lockedUntil: null,
  };
}

export async function recordLoginAttempt(
  identifier: string,
  loginType: string,
  success: boolean
) {
  await prisma.loginAttempt.create({
    data: { identifier, loginType, success },
  });

  // 성공 시 해당 identifier의 실패 기록 삭제 (loginType 무관)
  if (success) {
    await prisma.loginAttempt.deleteMany({
      where: {
        identifier,
        success: false,
      },
    });
  }
}
