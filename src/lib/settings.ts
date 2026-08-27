import "server-only";
import { prisma } from "@/lib/prisma";

// §44: "지각 기준 시간은 관리자 설정으로 둔다" — Phase 8부터 DB에 저장된 값을 사용한다.
export const LATE_GRACE_MINUTES_KEY = "LATE_GRACE_MINUTES";
const DEFAULT_LATE_GRACE_MINUTES = 5;

export async function getLateGraceMinutes(): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key: LATE_GRACE_MINUTES_KEY } });
  if (!row) return DEFAULT_LATE_GRACE_MINUTES;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_LATE_GRACE_MINUTES;
}

export async function setLateGraceMinutes(minutes: number, updatedBy: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key: LATE_GRACE_MINUTES_KEY },
    update: { value: String(minutes), updatedBy },
    create: { key: LATE_GRACE_MINUTES_KEY, value: String(minutes), updatedBy },
  });
}
