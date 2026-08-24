import "server-only";
import { prisma } from "./prisma";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 5;

/**
 * 최근 WINDOW_MINUTES 분 동안 연속 MAX_ATTEMPTS회 실패했는지 확인합니다.
 * 중간에 한 번이라도 성공 기록이 있으면 잠금 해제된 것으로 간주합니다.
 */
export async function isLoginLocked(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const recentAttempts = await prisma.loginAttempt.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: MAX_ATTEMPTS,
  });

  if (recentAttempts.length < MAX_ATTEMPTS) return false;
  return recentAttempts.every((attempt) => !attempt.success);
}

export async function recordLoginAttempt(userId: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { userId, success } });
}
