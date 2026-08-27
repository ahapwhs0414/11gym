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

export function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
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

/** 관리자가 정규 마감(금요일 21:00) 이전에 해당 주 투표를 조기 마감시켰는지 조회한다. */
export async function getVotingClosure(weekStart: Date) {
  return prisma.votingClosure.findUnique({ where: { weekStart: utcDateOnly(weekStart) } });
}

export async function isVotingClosedEarly(weekStart: Date): Promise<boolean> {
  return (await getVotingClosure(weekStart)) !== null;
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

/** 명세서 §3.3: 이 날짜가 "주말형 일정"으로 지정되었는지(공휴일 등) 판단할 때 쓰는 날짜 집합. */
export type WeekendPatternDates = Set<string>;

export async function getWeekendPatternDates(
  weekStart: Date,
  weekEnd: Date
): Promise<WeekendPatternDates> {
  const rows = await prisma.specialScheduleDay.findMany({
    where: { date: { gte: weekStart, lt: weekEnd } },
  });
  return new Set(rows.map((r) => toDateOnlyString(r.date)));
}

/** 해당 날짜가 (요일상 주말이거나 관리자가 지정한 주말형 일정이라) 3타임 패턴을 써야 하는지 판단한다. */
export function usesWeekendPattern(date: Date, weekendPatternDates: WeekendPatternDates): boolean {
  const dow = date.getUTCDay(); // 0=일 ... 6=토
  return dow === 0 || dow === 6 || weekendPatternDates.has(toDateOnlyString(date));
}

/** 해당 날짜에 필요한 시간 슬롯 목록(평일 1개 또는 주말형 3개)을 반환한다. */
export function getDaySlotTimes(date: Date, weekendPatternDates: WeekendPatternDates) {
  return usesWeekendPattern(date, weekendPatternDates) ? WEEKEND_SLOTS : [WEEKDAY_SLOT];
}

function slotDatesForWeek(weekStart: Date, weekendPatternDates: WeekendPatternDates) {
  const results: { date: Date; startTime: string; endTime: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    for (const slot of getDaySlotTimes(date, weekendPatternDates)) {
      results.push({ date, startTime: slot.startTime, endTime: slot.endTime });
    }
  }
  return results;
}

/**
 * 해당 주(월~일)의 직감 슬롯이 없으면 생성하고, 날짜/시간 순으로 정렬해 반환한다.
 * 관리자가 지정한 주말형 일정(§3.3)이 있으면 해당 날짜는 3타임으로 생성한다.
 * 이미 슬롯이 존재하는 날짜에 나중에 지정해도 기존 슬롯은 그대로 두고 나머지만 추가한다.
 */
export async function ensureDutySlotsForWeek(weekStart: Date): Promise<DutySlot[]> {
  const weekEnd = addDays(weekStart, 7);
  const weekendPatternDates = await getWeekendPatternDates(weekStart, weekEnd);
  const wanted = slotDatesForWeek(weekStart, weekendPatternDates);

  await prisma.dutySlot.createMany({
    data: wanted.map((slot) => ({
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    })),
    skipDuplicates: true,
  });

  const slots = await prisma.dutySlot.findMany({
    where: { date: { gte: weekStart, lt: weekEnd } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  return slots;
}
