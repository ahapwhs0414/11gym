import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { ScheduleCalendar } from "@/components/schedule/schedule-calendar";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: Date) {
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일(${DAY_LABELS[date.getUTCDay()]})`;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; month?: string }>;
}) {
  const session = await requireUserSession();
  const sp = await searchParams;
  const view = sp.view === "calendar" ? "calendar" : "list";

  const assignments = await prisma.dutyAssignment.findMany({
    where: { userId: session.userId },
    include: { dutySlot: true, gym: true },
    orderBy: [{ dutySlot: { date: "asc" } }],
  });

  const todayStr = toDateOnly(new Date());
  const upcoming = assignments.filter((a) => toDateOnly(a.dutySlot.date) >= todayStr);
  const past = [...assignments.filter((a) => toDateOnly(a.dutySlot.date) < todayStr)].reverse();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/home" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/login" />
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">내 전체 일정</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈으로
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          <Link
            href="/schedule?view=list"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              view === "list" ? "bg-teal-700 text-white" : "border border-slate-300 text-slate-600"
            }`}
          >
            목록 보기
          </Link>
          <Link
            href="/schedule?view=calendar"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              view === "calendar"
                ? "bg-teal-700 text-white"
                : "border border-slate-300 text-slate-600"
            }`}
          >
            캘린더 보기
          </Link>
        </div>

        {view === "calendar" ? (
          <ScheduleCalendar
            monthParam={sp.month}
            assignments={assignments.map((a) => ({
              date: toDateOnly(a.dutySlot.date),
              startTime: a.dutySlot.startTime,
              endTime: a.dutySlot.endTime,
              gymName: a.gym.name,
            }))}
          />
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-700">다가오는 일정</h2>
              <div className="mt-2 space-y-2">
                {upcoming.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
                    예정된 직감이 없습니다.
                  </p>
                )}
                {upcoming.map((a) => (
                  <Link
                    key={a.id}
                    href={`/duty/${a.id}`}
                    className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm transition hover:border-teal-300"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatDateLabel(a.dutySlot.date)}
                      </p>
                      <p className="text-slate-500">
                        {a.dutySlot.startTime} ~ {a.dutySlot.endTime}
                      </p>
                    </div>
                    <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
                      {a.gym.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-700">지난 일정</h2>
              <div className="mt-2 space-y-2">
                {past.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
                    지난 직감 기록이 없습니다.
                  </p>
                )}
                {past.map((a) => (
                  <Link
                    key={a.id}
                    href={`/duty/${a.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm transition hover:border-teal-300"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {formatDateLabel(a.dutySlot.date)}
                      </p>
                      <p className="text-slate-500">
                        {a.dutySlot.startTime} ~ {a.dutySlot.endTime}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      {a.gym.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
