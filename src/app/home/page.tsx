import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateLabel(date: Date) {
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일(${DAY_LABELS[date.getUTCDay()]})`;
}

export default async function UserHomePage() {
  const session = await requireUserSession();

  const todayStr = new Date().toISOString().slice(0, 10);
  const [nextDuty, pendingExchangeCount] = await Promise.all([
    prisma.dutyAssignment.findFirst({
      where: { userId: session.userId, dutySlot: { date: { gte: new Date(todayStr) } } },
      include: { dutySlot: true, gym: true },
      orderBy: [{ dutySlot: { date: "asc" } }],
    }),
    prisma.dutyExchangeRequest.count({
      where: { replacementUserId: session.userId, status: "PENDING" },
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            설정
          </Link>
          <LogoutButton redirectTo="/login" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900">
          {session.name}님, 안녕하세요
        </h1>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">다음 직감</p>
          {nextDuty ? (
            <>
              <div className="mt-2 flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {formatDateLabel(nextDuty.dutySlot.date)}
                  </p>
                  <p className="text-sm text-slate-500">
                    {nextDuty.dutySlot.startTime} ~ {nextDuty.dutySlot.endTime}
                  </p>
                </div>
                <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
                  {nextDuty.gym.name}
                </span>
              </div>
              <Link
                href={`/duty/${nextDuty.id}`}
                className="mt-3 block rounded-lg bg-teal-700 py-2 text-center text-sm font-semibold text-white transition hover:bg-teal-800"
              >
                직감 시작하기
              </Link>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-400">예정된 직감이 없습니다.</p>
          )}
        </div>

        <Link
          href="/schedule"
          className="mt-3 block rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition hover:border-teal-300"
        >
          내 전체 일정 보기 →
        </Link>

        <Link
          href="/availability"
          className="mt-3 block rounded-2xl border border-teal-200 bg-teal-50 p-5 transition hover:border-teal-300"
        >
          <p className="text-sm font-semibold text-teal-800">다음 주 직감 가능 시간 투표</p>
          <p className="mt-1 text-xs text-teal-700">가능한 시간을 선택해주세요 →</p>
        </Link>

        <Link
          href="/exchanges"
          className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-700 transition hover:border-teal-300"
        >
          <span>직감 교환</span>
          {pendingExchangeCount > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white">
              받은 요청 {pendingExchangeCount}
            </span>
          )}
        </Link>
      </main>
    </div>
  );
}
