import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { MarkAbsentButton } from "@/components/admin/mark-absent-button";
import {
  addDays,
  getDaySlotTimes,
  getWeekendPatternDates,
  startOfWeekMonday,
  utcDateOnly,
} from "@/lib/duty-week";
import type { DutyAssignment, DutyLog, Gym, User } from "@prisma/client";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function AttendanceInfo({
  assignment,
  dutyLog,
  isPast,
}: {
  assignment: DutyAssignment & { user: User; gym: Gym };
  dutyLog: DutyLog | undefined;
  isPast: boolean;
}) {
  if (!dutyLog || !dutyLog.startedAt) {
    if (dutyLog?.status === "ABSENT") {
      return <p className="text-[11px] font-medium text-red-600">결석</p>;
    }
    if (isPast) {
      return <MarkAbsentButton assignmentId={assignment.id} />;
    }
    return null;
  }
  return (
    <p className="text-[11px] text-slate-500">
      출석{dutyLog.startedLate && <span className="text-amber-600"> (지각)</span>}
      {dutyLog.endedAt && (
        <>
          {" "}
          · 종료{dutyLog.endedEarly && <span className="text-amber-600"> (조기)</span>}
        </>
      )}
      {!dutyLog.endedAt && <span className="text-teal-700"> · 진행 중</span>}
    </p>
  );
}

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;

  const weekStart =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? utcDateOnly(new Date(`${sp.week}T00:00:00.000Z`))
      : startOfWeekMonday(new Date());
  const weekEnd = addDays(weekStart, 7);

  const slots = await prisma.dutySlot.findMany({
    where: { date: { gte: weekStart, lt: weekEnd } },
    include: {
      assignments: { include: { user: true, gym: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const slotByKey = new Map(slots.map((s) => [`${toDateOnly(s.date)}_${s.startTime}`, s]));

  const assignmentIds = slots.flatMap((s) => s.assignments.map((a) => a.id));
  const dutyLogs = await prisma.dutyLog.findMany({
    where: { assignmentId: { in: assignmentIds } },
  });
  const dutyLogByAssignmentId = new Map(dutyLogs.map((d) => [d.assignmentId, d]));

  const todayStr = toDateOnly(new Date());

  const weekendPatternDates = await getWeekendPatternDates(weekStart, weekEnd);
  const expectedRows: { date: Date; startTime: string; endTime: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    for (const s of getDaySlotTimes(date, weekendPatternDates)) {
      expectedRows.push({ date, startTime: s.startTime, endTime: s.endTime });
    }
  }

  const prevWeek = toDateOnly(addDays(weekStart, -7));
  const nextWeek = toDateOnly(addDays(weekStart, 7));

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">직감 전체 일정</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="mb-2 flex justify-end">
          <Link
            href="/admin/special-days"
            className="text-sm text-teal-700 hover:underline"
          >
            주말형 일정(공휴일 등) 관리 →
          </Link>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/admin/schedule?week=${prevWeek}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            ← 이전 주
          </Link>
          <p className="text-sm font-semibold text-slate-900">
            {toDateOnly(weekStart)} ~ {toDateOnly(addDays(weekStart, 6))}
          </p>
          <Link
            href={`/admin/schedule?week=${nextWeek}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            다음 주 →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">날짜</th>
                <th className="px-4 py-2">시간</th>
                <th className="px-4 py-2">힘레븐1</th>
                <th className="px-4 py-2">힘레븐2</th>
                <th className="px-4 py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {expectedRows.map((row) => {
                const key = `${toDateOnly(row.date)}_${row.startTime}`;
                const slot = slotByKey.get(key);
                const gym1 = slot?.assignments.find((a) => a.gym.name === "힘레븐1");
                const gym2 = slot?.assignments.find((a) => a.gym.name === "힘레븐2");
                const isPast = toDateOnly(row.date) < todayStr;
                const dow = row.date.getUTCDay();
                const isSpecialOverride =
                  dow !== 0 && dow !== 6 && weekendPatternDates.has(toDateOnly(row.date));
                return (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="px-4 py-2 text-slate-700">
                      {row.date.getUTCMonth() + 1}/{row.date.getUTCDate()}(
                      {DAY_LABELS[row.date.getUTCDay()]})
                      {isSpecialOverride && (
                        <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">
                          특별일정
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {row.startTime} ~ {row.endTime}
                    </td>
                    <td className="px-4 py-2">
                      {gym1 ? (
                        <>
                          <span className="text-slate-900">{gym1.user.name}</span>
                          <AttendanceInfo
                            assignment={gym1}
                            dutyLog={dutyLogByAssignmentId.get(gym1.id)}
                            isPast={isPast}
                          />
                        </>
                      ) : (
                        <span className="text-red-500">미배정</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {gym2 ? (
                        <>
                          <span className="text-slate-900">{gym2.user.name}</span>
                          <AttendanceInfo
                            assignment={gym2}
                            dutyLog={dutyLogByAssignmentId.get(gym2.id)}
                            isPast={isPast}
                          />
                        </>
                      ) : (
                        <span className="text-red-500">미배정</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {!slot && <span className="text-slate-400">슬롯 미생성</span>}
                      {slot?.status === "COMPLETED" && (
                        <span className="text-teal-700">완료</span>
                      )}
                      {slot?.status === "UNDERSTAFFED" && (
                        <span className="text-amber-600">미배정 있음</span>
                      )}
                      {slot?.status === "OPEN" && <span className="text-slate-400">투표 중</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
