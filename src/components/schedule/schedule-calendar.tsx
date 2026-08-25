import Link from "next/link";

type AssignmentDay = {
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  gymName: string;
};

function parseMonth(monthParam: string | undefined): { year: number; month: number } {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    return { year: y, month: m - 1 };
  }
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

function monthParamOf(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function ScheduleCalendar({
  monthParam,
  assignments,
}: {
  monthParam: string | undefined;
  assignments: AssignmentDay[];
}) {
  const { year, month } = parseMonth(monthParam);
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month + 1, 1));

  // 달력 그리드는 월요일 시작. 1일이 속한 주의 월요일부터 42칸(6주) 렌더링.
  const firstDow = monthStart.getUTCDay(); // 0=일 ... 6=토
  const diffToMonday = firstDow === 0 ? -6 : 1 - firstDow;
  const gridStart = new Date(monthStart.getTime() + diffToMonday * 86400000);

  const byDate = new Map<string, AssignmentDay>();
  for (const a of assignments) byDate.set(a.date, a);

  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getTime() + i * 86400000);
    const dateStr = toDateOnly(date);
    return {
      dateStr,
      day: date.getUTCDate(),
      inMonth: date >= monthStart && date < monthEndExclusive,
      assignment: byDate.get(dateStr),
    };
  });

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  const monthAssignments = assignments
    .filter((a) => a.date >= toDateOnly(monthStart) && a.date < toDateOnly(monthEndExclusive))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={`/schedule?view=calendar&month=${monthParamOf(prev.year, prev.month)}`}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600"
        >
          ← 이전
        </Link>
        <p className="text-sm font-semibold text-slate-900">
          {year}년 {month + 1}월
        </p>
        <Link
          href={`/schedule?view=calendar&month=${monthParamOf(next.year, next.month)}`}
          className="rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-600"
        >
          다음 →
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-400">
        {["월", "화", "수", "목", "금", "토", "일"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => (
          <div
            key={cell.dateStr}
            className={`aspect-square rounded-lg border p-1 text-xs ${
              cell.inMonth ? "border-slate-200 bg-white" : "border-transparent text-slate-300"
            }`}
          >
            <p className={cell.inMonth ? "text-slate-700" : "text-slate-300"}>
              {new Date(cell.dateStr).getUTCDate()}
            </p>
            {cell.assignment && (
              <p className="mt-1 truncate rounded bg-teal-100 px-1 text-[10px] font-semibold text-teal-800">
                {cell.assignment.gymName.replace("힘레븐", "힘")}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {monthAssignments.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
            이번 달에는 직감 일정이 없습니다.
          </p>
        )}
        {monthAssignments.map((a) => (
          <div
            key={`${a.date}-${a.startTime}`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm"
          >
            <span className="text-slate-700">
              {a.date.slice(5).replace("-", "/")} {a.startTime} ~ {a.endTime}
            </span>
            <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
              {a.gymName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
