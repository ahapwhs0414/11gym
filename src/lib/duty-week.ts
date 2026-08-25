import "server-only";
import { prisma } from "./prisma";
import type { DutySlot } from "@prisma/client";

// KST는 DST가 없는 UTC+9 고정 오프셋이므로 별도 타임존 라이브러리 없이 계산한다.
const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAY_SLOT = { startTime: "19:30", endTime: "21:30" } as const;

export const WEEKEND_SLOTS = [
  { startTime: "10:30", endTime: "12:30" },
  { startTime: "15:00", endTime: "17:00" },
  { startTime: "19:30", endTime: "21:30" },
] as const;

export function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** 주어진 시각을 포함하는 주(월~일)의 월요일 00:00 UTC를 반환한다. */
export function startOfWeekMonday(date: Date): Date {
  const d = utcDateOnly(date);
  const dow = d.getUTCDay(); // 0=일 ... 6=토
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(d, diffToMonday);
}

/**
 * weekStart(월요일)에 대한 투표 마감 시각을 반환한다.
 * 명세서 §15: 마감은 해당 주 시작 전 금요일 21:00 KST.
 * weekStart - 3일 = 그 전주 금요일. KST 21:00 = UTC 12:00 (같은 날짜).
 */
export function getVotingDeadline(weekStart: Date): Date {
  const friday = addDays(utcDateOnly(weekStart), -3);
  return new Date(friday.getTime() + 12 * 60 * 60 * 1000);
}

export function isVotingOpen(weekStart: Date, now: Date = new Date()): boolean {
  return now.getTime() < getVotingDeadline(weekStart).getTime();
}

/**
 * 현재 시각 기준으로 "아직 마감 전인 가장 빠른 다음 주"의 월요일을 반환한다.
 * 마감이 지난 주는 건너뛴다.
 */
export function getVotingTargetWeekStart(now: Date = new Date()): Date {
  let candidate = addDays(startOfWeekMonday(now), 7);
  while (!isVotingOpen(candidate, now)) {
    candidate = addDays(candidate, 7);
  }
  return candidate;
}

/**
 * 방금 마감된(=배정 대상) 주의 월요일을 반환한다.
 * getVotingTargetWeekStart()가 반환하는 "아직 투표 가능한 다음 주"의 바로 전 주가 항상
 * "마감이 막 지난, 이번에 배정해야 할 주"이다.
 */
export function getAssignmentTargetWeekStart(now: Date = new Date()): Date {
  return addDays(getVotingTargetWeekStart(now), -7);
}

function slotDatesForWeek(weekStart: Date) {
  const results: { date: Date; startTime: string; endTime: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const dow = date.getUTCDay(); // 0=일 ... 6=토
    const isWeekend = dow === 0 || dow === 6;
    const daySlots = isWeekend ? WEEKEND_SLOTS : [WEEKDAY_SLOT];
    for (const slot of daySlots) {
      results.push({ date, startTime: slot.startTime, endTime: slot.endTime });
    }
  }
  return results;
}

/** 해당 주(월~일)의 직감 슬롯이 없으면 생성하고, 날짜/시간 순으로 정렬해 반환한다. */
export async function ensureDutySlotsForWeek(weekStart: Date): Promise<DutySlot[]> {
  const wanted = slotDatesForWeek(weekStart);

  await prisma.dutySlot.createMany({
    data: wanted.map((slot) => ({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    skipDuplicates: true,
  });

  const weekEnd = addDays(weekStart, 7);
  const slots = await prisma.dutySlot.findMany({
    where: { date: { gte: weekStart, lt: weekEnd } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return slots;
}
