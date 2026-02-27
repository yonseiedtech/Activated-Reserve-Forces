import { prisma } from "./prisma";

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15분

export async function checkRateLimit(identifier: string, loginType: string) {
  const windowStart = new Date(Date.now() - LOCK_DURATION_MS);

  const failedAttempts = await prisma.loginAttempt.count({
    where: {
      identifier,
      loginType,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (failedAttempts >= MAX_ATTEMPTS) {
    // 마지막 실패 시각 기준으로 잠금 해제 시간 계산
    const lastAttempt = await prisma.loginAttempt.findFirst({
      where: {
        identifier,
        loginType,
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

  // 성공 시 해당 identifier의 실패 기록 삭제
  if (success) {
    await prisma.loginAttempt.deleteMany({
      where: {
        identifier,
        loginType,
        success: false,
      },
    });
  }
}
