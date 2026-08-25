import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDutyLog } from "@/lib/duty-log";
import { LogoutButton } from "@/components/logout-button";
import { DutyPanel } from "@/components/duty/duty-panel";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateLabel(date: Date) {
  return `${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일(${DAY_LABELS[date.getUTCDay()]})`;
}

export default async function DutyPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const session = await requireUserSession();
  const { assignmentId } = await params;

  const assignment = await prisma.dutyAssignment.findUnique({
    where: { id: assignmentId },
    include: { dutySlot: true, gym: true },
  });
  if (!assignment || assignment.userId !== session.userId) {
    notFound();
  }

  const dutyLog = await ensureDutyLog(assignmentId);
  const checklistItems = await prisma.checklistItem.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const checklistLogs = await prisma.checklistLog.findMany({
    where: { dutyLogId: dutyLog.id },
  });
  const completedByItemId = new Map(checklistLogs.map((l) => [l.checklistItemId, l.completed]));

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
          <h1 className="text-xl font-bold text-slate-900">직감 상세</h1>
          <Link href="/schedule" className="text-sm text-teal-700 hover:underline">
            ← 전체 일정
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-lg font-bold text-slate-900">
            {formatDateLabel(assignment.dutySlot.date)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {assignment.dutySlot.startTime} ~ {assignment.dutySlot.endTime}
          </p>
          <span className="mt-2 inline-block rounded-full bg-teal-700 px-3 py-1 text-xs font-semibold text-white">
            {assignment.gym.name}
          </span>
        </div>

        <DutyPanel
          assignmentId={assignmentId}
          startedAt={dutyLog.startedAt?.toISOString() ?? null}
          startedLate={dutyLog.startedLate}
          endedAt={dutyLog.endedAt?.toISOString() ?? null}
          endedEarly={dutyLog.endedEarly}
          checklistItems={checklistItems.map((item) => ({
            id: item.id,
            name: item.name,
            required: item.required,
            completed: completedByItemId.get(item.id) ?? false,
          }))}
        />
      </main>
    </div>
  );
}
