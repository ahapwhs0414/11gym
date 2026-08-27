import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { VotingClosurePanel } from "@/components/admin/voting-closure-panel";
import {
  ensureDutySlotsForWeek,
  getVotingClosure,
  getVotingDeadline,
  getVotingTargetWeekStart,
  toDateOnlyString,
} from "@/lib/duty-week";

export default async function AdminVotingPage() {
  await requireAdminSession();

  const weekStart = getVotingTargetWeekStart();
  const deadline = getVotingDeadline(weekStart);
  const [closure, slots, activeUserCount] = await Promise.all([
    getVotingClosure(weekStart),
    ensureDutySlotsForWeek(weekStart),
    prisma.user.count({ where: { role: "USER", status: "ACTIVE" } }),
  ]);

  const votingRows = await prisma.availability.findMany({
    where: { dutySlotId: { in: slots.map((s) => s.id) } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const submittedCount = votingRows.length;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">투표 마감 관리</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">
            {toDateOnlyString(weekStart)} 주 (정규 마감: {deadline.toLocaleString("ko-KR")})
          </p>
          <p className="mt-1 text-sm text-slate-500">
            투표 제출 {submittedCount}명 / 전체 활성 사용자 {activeUserCount}명
          </p>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <VotingClosurePanel weekStart={toDateOnlyString(weekStart)} isClosed={!!closure} />
        </section>
      </main>
    </div>
  );
}
