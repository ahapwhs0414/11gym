import "server-only";
import { prisma } from "@/lib/prisma";

// §44: "지각 기준 시간은 관리자 설정으로 둔다" — Phase 8부터 DB에 저장된 값을 사용한다.
export const LATE_GRACE_MINUTES_KEY = "LATE_GRACE_MINUTES";
const DEFAULT_LATE_GRACE_MINUTES = 5;

// §47: 조기 종료 판정에도 동일하게 유예 시간을 둔다. 예정 종료 시각으로부터 이 시간(분) 이내에
// 종료하면 조기 종료로 취급하지 않는다.
export const EARLY_END_GRACE_MINUTES_KEY = "EARLY_END_GRACE_MINUTES";
const DEFAULT_EARLY_END_GRACE_MINUTES = 5;

async function getGraceMinutes(key: string, defaultValue: number): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  if (!row) return defaultValue;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

async function setGraceMinutes(key: string, minutes: number, updatedBy: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value: String(minutes), updatedBy },
    create: { key, value: String(minutes), updatedBy },
  });
}

export function getLateGraceMinutes(): Promise<number> {
  return getGraceMinutes(LATE_GRACE_MINUTES_KEY, DEFAULT_LATE_GRACE_MINUTES);
}

export function setLateGraceMinutes(minutes: number, updatedBy: string): Promise<void> {
  return setGraceMinutes(LATE_GRACE_MINUTES_KEY, minutes, updatedBy);
}

export function getEarlyEndGraceMinutes(): Promise<number> {
  return getGraceMinutes(EARLY_END_GRACE_MINUTES_KEY, DEFAULT_EARLY_END_GRACE_MINUTES);
}

export function setEarlyEndGraceMinutes(minutes: number, updatedBy: string): Promise<void> {
  return setGraceMinutes(EARLY_END_GRACE_MINUTES_KEY, minutes, updatedBy);
}
