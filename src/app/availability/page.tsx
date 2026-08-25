import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDutySlotsForWeek, getVotingDeadline, getVotingTargetWeekStart } from "@/lib/duty-week";
import { LogoutButton } from "@/components/logout-button";
import { AvailabilityForm } from "@/components/availability/availability-form";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDate(date: Date) {
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일`;
}

function formatDateTime(date: Date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, "0");
  const mm = String(kst.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(kst)}(${DAY_LABELS[kst.getUTCDay()]}) ${hh}:${mm}`;
}

export default async function AvailabilityPage() {
  const session = await requireUserSession();

  const weekStart = getVotingTargetWeekStart();
  const deadline = getVotingDeadline(weekStart);
  const slots = await ensureDutySlotsForWeek(weekStart);

  const existing = await prisma.availability.findMany({
    where: { userId: session.userId, dutySlotId: { in: slots.map((s) => s.id) } },
  });
  const availableMap = new Map(existing.map((a) => [a.dutySlotId, a.available]));

  const formSlots = slots.map((slot) => ({
    id: slot.id,
    dayLabel: DAY_LABELS[slot.date.getUTCDay()],
    dateLabel: formatDate(slot.date),
    startTime: slot.startTime,
    endTime: slot.endTime,
    available: availableMap.get(slot.id) ?? false,
  }));

  const hasSubmitted = existing.length > 0;

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
          <h1 className="text-xl font-bold text-slate-900">직감 가능 시간 투표</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈으로
          </Link>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">
            {formatDate(weekStart)} ~ {formatDate(new Date(weekStart.getTime() + 6 * 86400000))} 주
          </p>
          <p className="mt-1">투표 마감: {formatDateTime(deadline)}</p>
          {hasSubmitted && <p className="mt-1 text-amber-700">이미 제출한 내용을 수정할 수 있습니다.</p>}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs text-slate-500">
            기본값은 모두 &ldquo;불가능&rdquo;입니다. 직감을 설 수 있는 시간만 켜주세요.
          </p>
          <AvailabilityForm slots={formSlots} hasSubmitted={hasSubmitted} />
        </div>
      </main>
    </div>
  );
}
