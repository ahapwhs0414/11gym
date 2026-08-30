import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/prisma";
import {
  addDays,
  ensureDutySlotsForWeek,
  getVotingTargetWeekStart,
  startOfWeekMonday,
  toDateOnlyString,
} from "@/lib/duty-week";

function StatCard({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${warn ? "text-amber-600" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

const NAV_LINKS = [
  { href: "/admin/users", label: "사용자 관리" },
  { href: "/admin/schedule", label: "직감 전체 일정" },
  { href: "/admin/voting", label: "투표 마감 관리" },
  { href: "/admin/monthly", label: "월간 직감 기록" },
  { href: "/admin/statistics", label: "공평성 통계" },
  { href: "/admin/complaints", label: "의견 관리" },
  { href: "/admin/notices", label: "공지 관리" },
  { href: "/admin/audit-logs", label: "감사 로그" },
  { href: "/admin/special-days", label: "주말형 일정 관리" },
  { href: "/admin/checklist", label: "체크리스트 관리" },
  { href: "/admin/settings", label: "시스템 설정" },
  { href: "/admin/password", label: "비밀번호 변경" },
];

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();

  const today = new Date(new Date().toISOString().slice(0, 10));
  const thisWeekStart = startOfWeekMonday(today);
  const thisWeekEnd = addDays(thisWeekStart, 7);
  const nextWeekStart = getVotingTargetWeekStart();

  const [totalUsers, activeUsers] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", status: "ACTIVE" } }),
  ]);

  const thisWeekAssignments = await prisma.dutyAssignment.findMany({
    where: { dutySlot: { date: { gte: thisWeekStart, lt: thisWeekEnd } } },
    include: { dutyLog: true },
  });
  const thisWeekAssignedUsers = new Set(thisWeekAssignments.map((a) => a.userId)).size;
  const lateCount = thisWeekAssignments.filter((a) => a.dutyLog?.startedLate).length;
  const absentCount = thisWeekAssignments.filter((a) => a.dutyLog?.status === "ABSENT").length;
  const checklistPendingCount = thisWeekAssignments.filter(
    (a) => a.dutyLog?.startedAt && !a.dutyLog?.endedAt
  ).length;

  const nextWeekSlots = await ensureDutySlotsForWeek(nextWeekStart);
  const nextWeekAssignments = await prisma.dutyAssignment.findMany({
    where: { dutySlotId: { in: nextWeekSlots.map((s) => s.id) } },
  });
  const nextWeekAssignedUsers = new Set(nextWeekAssignments.map((a) => a.userId)).size;

  const understaffedSlots = await prisma.dutySlot.count({
    where: { status: "UNDERSTAFFED", date: { gte: today } },
  });

  const exchangeCompletedThisWeek = await prisma.dutyExchangeRequest.count({
    where: { status: "ACCEPTED", acceptedAt: { gte: thisWeekStart, lt: thisWeekEnd } },
  });

  const votingRows = await prisma.availability.findMany({
    where: { dutySlotId: { in: nextWeekSlots.map((s) => s.id) } },
  });
  const submittedUserIds = new Set(votingRows.map((r) => r.userId));
  const allUnavailableUserIds = new Set<string>();
  const availableByUser = new Map<string, number>();
  for (const row of votingRows) {
    if (row.available) availableByUser.set(row.userId, (availableByUser.get(row.userId) ?? 0) + 1);
  }
  for (const userId of submittedUserIds) {
    if (!availableByUser.get(userId)) allUnavailableUserIds.add(userId);
  }
  const notSubmittedCount = activeUsers - submittedUserIds.size;

  const nextWeekCandidateCounts = nextWeekSlots.map((slot) => {
    const count = votingRows.filter((r) => r.dutySlotId === slot.id && r.available).length;
    return { slot, count };
  });
  const riskLevels = nextWeekCandidateCounts.map(({ slot, count }) => ({
    date: toDateOnlyString(slot.date),
    startTime: slot.startTime,
    count,
    level: count <= 1 ? "위험" : count <= 4 ? "주의" : "안정",
  }));
  const riskySlots = riskLevels.filter((r) => r.level !== "안정");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">관리자 대시보드</span>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900">{session.name} 관리자님</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {NAV_LINKS.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                i === 0
                  ? "rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
                  : "rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              }
            >
              {link.label}
            </Link>
          ))}
        </div>

        <p className="mt-6 text-sm font-semibold text-slate-700">전체 현황</p>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <StatCard label="전체 사용자" value={`${totalUsers}명`} />
          <StatCard label="활성 사용자" value={`${activeUsers}명`} />
        </div>

        <p className="mt-6 text-sm font-semibold text-slate-700">이번 주</p>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="이번 주 직감자" value={`${thisWeekAssignedUsers}명`} />
          <StatCard label="지각" value={`${lateCount}건`} warn={lateCount > 0} />
          <StatCard label="결석" value={`${absentCount}건`} warn={absentCount > 0} />
          <StatCard label="체크리스트 미완료" value={`${checklistPendingCount}건`} warn={checklistPendingCount > 0} />
        </div>

        <p className="mt-6 text-sm font-semibold text-slate-700">다음 주 (투표/배정)</p>
        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="다음 주 직감자" value={`${nextWeekAssignedUsers}명`} />
          <StatCard
            label="투표 미제출자"
            value={`${notSubmittedCount}명`}
            warn={notSubmittedCount > 0}
          />
          <StatCard label="전체 불가능 체크" value={`${allUnavailableUserIds.size}명`} />
          <StatCard
            label="미배정 슬롯"
            value={`${understaffedSlots}건`}
            warn={understaffedSlots > 0}
          />
        </div>

        <p className="mt-6 text-sm font-semibold text-slate-700">기타</p>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <StatCard label="이번 주 교환 완료" value={`${exchangeCompletedThisWeek}건`} />
        </div>

        {riskySlots.length > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-800">다음 주 배정 위험도</p>
            <div className="mt-2 space-y-1 text-sm">
              {riskySlots.map((r) => (
                <div key={`${r.date}-${r.startTime}`} className="flex items-center justify-between">
                  <span className="text-amber-900">
                    {r.date} {r.startTime} · 가능 후보 {r.count}명
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.level === "위험" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
