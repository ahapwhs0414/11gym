import "server-only";
import { prisma } from "@/lib/prisma";

export function getMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));
  return { start, end };
}

export type AttendanceFilter = "NORMAL" | "LATE" | "ABSENT" | "EARLY";

export interface MonthlyRow {
  assignmentId: string;
  date: string;
  startTime: string;
  endTime: string;
  gymName: string;
  userId: string;
  userName: string;
  startedAt: Date | null;
  endedAt: Date | null;
  startedLate: boolean;
  endedEarly: boolean;
  dutyLogStatus: "SCHEDULED" | "COMPLETED" | "ABSENT";
  wasExchanged: boolean;
  issueNote: string | null;
}

/** 명세서 §49-50/§80: 월간 직감 기록을 사용자/헬스장/상태 필터와 함께 조회한다. */
export async function fetchMonthlyRows(params: {
  year: number;
  month: number;
  userId?: string;
  gymId?: string;
  attendance?: AttendanceFilter;
}): Promise<MonthlyRow[]> {
  const { start, end } = getMonthRange(params.year, params.month);

  const assignments = await prisma.dutyAssignment.findMany({
    where: {
      dutySlot: { date: { gte: start, lt: end } },
      userId: params.userId || undefined,
      gymId: params.gymId || undefined,
    },
    include: {
      dutySlot: true,
      user: true,
      gym: true,
      dutyLog: true,
      history: true,
    },
    orderBy: [{ dutySlot: { date: "asc" } }, { dutySlot: { startTime: "asc" } }],
  });

  const rows: MonthlyRow[] = assignments.map((a) => ({
    assignmentId: a.id,
    date: a.dutySlot.date.toISOString().slice(0, 10),
    startTime: a.dutySlot.startTime,
    endTime: a.dutySlot.endTime,
    gymName: a.gym.name,
    userId: a.userId,
    userName: a.user.name,
    startedAt: a.dutyLog?.startedAt ?? null,
    endedAt: a.dutyLog?.endedAt ?? null,
    startedLate: a.dutyLog?.startedLate ?? false,
    endedEarly: a.dutyLog?.endedEarly ?? false,
    dutyLogStatus: a.dutyLog?.status ?? "SCHEDULED",
    wasExchanged: a.assignedType === "EXCHANGE" || a.history.some((h) => h.changeType === "EXCHANGE"),
    issueNote: a.dutyLog?.issueNote ?? null,
  }));

  if (!params.attendance) return rows;
  return rows.filter((r) => {
    if (params.attendance === "ABSENT") return r.dutyLogStatus === "ABSENT";
    if (params.attendance === "LATE") return r.startedLate;
    if (params.attendance === "EARLY") return r.endedEarly;
    return r.dutyLogStatus !== "ABSENT" && !r.startedLate && !r.endedEarly;
  });
}

export interface MonthlyOverallStats {
  totalCount: number;
  perUserCounts: number[];
  averageCount: number;
  maxCount: number;
  minCount: number;
  lateCount: number;
  absentCount: number;
  earlyCount: number;
  exchangeCount: number;
  gym1Count: number;
  gym2Count: number;
}

/** 명세서 §52: 월간 전체 통계. */
export function computeMonthlyOverallStats(rows: MonthlyRow[]): MonthlyOverallStats {
  const countByUser = new Map<string, number>();
  let lateCount = 0;
  let absentCount = 0;
  let earlyCount = 0;
  let exchangeCount = 0;
  let gym1Count = 0;
  let gym2Count = 0;

  for (const row of rows) {
    countByUser.set(row.userId, (countByUser.get(row.userId) ?? 0) + 1);
    if (row.startedLate) lateCount += 1;
    if (row.dutyLogStatus === "ABSENT") absentCount += 1;
    if (row.endedEarly) earlyCount += 1;
    if (row.wasExchanged) exchangeCount += 1;
    if (row.gymName === "힘레븐1") gym1Count += 1;
    if (row.gymName === "힘레븐2") gym2Count += 1;
  }

  const perUserCounts = Array.from(countByUser.values());
  const totalCount = rows.length;
  const averageCount = perUserCounts.length > 0 ? totalCount / perUserCounts.length : 0;

  return {
    totalCount,
    perUserCounts,
    averageCount,
    maxCount: perUserCounts.length > 0 ? Math.max(...perUserCounts) : 0,
    minCount: perUserCounts.length > 0 ? Math.min(...perUserCounts) : 0,
    lateCount,
    absentCount,
    earlyCount,
    exchangeCount,
    gym1Count,
    gym2Count,
  };
}

export function rowsToCsv(rows: MonthlyRow[]): string {
  const header = ["날짜", "시간", "헬스장", "직감자", "출석", "종료", "상태", "교환여부", "문제/건의사항"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const attendance = r.dutyLogStatus === "ABSENT" ? "결석" : r.startedAt ? (r.startedLate ? "지각" : "정상") : "-";
    const ending = r.endedAt ? (r.endedEarly ? "조기" : "정상") : "-";
    const status =
      r.dutyLogStatus === "COMPLETED" ? "완료" : r.dutyLogStatus === "ABSENT" ? "결석" : "예정";
    const cells = [
      r.date,
      r.startTime,
      r.gymName,
      r.userName,
      attendance,
      ending,
      status,
      r.wasExchanged ? "예" : "아니오",
      r.issueNote ?? "",
    ];
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
  }
  return lines.join("\n");
}
