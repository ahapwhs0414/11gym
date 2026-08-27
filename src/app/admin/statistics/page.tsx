import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { addDays, startOfWeekMonday, toDateOnlyString, utcDateOnly } from "@/lib/duty-week";

/** 명세서 §53: 직감 공평성 통계. 선택한 주의 가능 슬롯/배정 횟수와, 전체 기간 누적 지표를 함께 보여준다. */
export default async function AdminStatisticsPage({
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
  const prevWeek = toDateOnlyString(addDays(weekStart, -7));
  const nextWeek = toDateOnlyString(addDays(weekStart, 7));

  const [users, gyms, weekSlots] = await Promise.all([
    prisma.user.findMany({ where: { role: "USER", status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.gym.findMany(),
    prisma.dutySlot.findMany({ where: { date: { gte: weekStart, lt: weekEnd } } }),
  ]);
  const weekSlotIds = weekSlots.map((s) => s.id);
  const gym1 = gyms.find((g) => g.name === "힘레븐1");
  const gym2 = gyms.find((g) => g.name === "힘레븐2");

  const [weekAvailability, weekAssignments, allAssignments] = await Promise.all([
    prisma.availability.findMany({
      where: { dutySlotId: { in: weekSlotIds }, available: true },
    }),
    prisma.dutyAssignment.findMany({ where: { dutySlotId: { in: weekSlotIds } } }),
    prisma.dutyAssignment.findMany({ select: { userId: true, gymId: true, dutySlot: { select: { date: true } } } }),
  ]);

  const availableCountByUser = new Map<string, number>();
  for (const row of weekAvailability) {
    availableCountByUser.set(row.userId, (availableCountByUser.get(row.userId) ?? 0) + 1);
  }
  const weekAssignedCountByUser = new Map<string, number>();
  for (const a of weekAssignments) {
    weekAssignedCountByUser.set(a.userId, (weekAssignedCountByUser.get(a.userId) ?? 0) + 1);
  }

  const totalCountByUser = new Map<string, number>();
  const gym1CountByUser = new Map<string, number>();
  const gym2CountByUser = new Map<string, number>();
  const lastDateByUser = new Map<string, string>();
  for (const a of allAssignments) {
    totalCountByUser.set(a.userId, (totalCountByUser.get(a.userId) ?? 0) + 1);
    if (gym1 && a.gymId === gym1.id) gym1CountByUser.set(a.userId, (gym1CountByUser.get(a.userId) ?? 0) + 1);
    if (gym2 && a.gymId === gym2.id) gym2CountByUser.set(a.userId, (gym2CountByUser.get(a.userId) ?? 0) + 1);
    const dateStr = toDateOnlyString(a.dutySlot.date);
    const prev = lastDateByUser.get(a.userId);
    if (!prev || dateStr > prev) lastDateByUser.set(a.userId, dateStr);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">직감 공평성 통계</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/admin/statistics?week=${prevWeek}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            ← 이전 주
          </Link>
          <p className="text-sm font-semibold text-slate-900">
            {toDateOnlyString(weekStart)} ~ {toDateOnlyString(addDays(weekStart, 6))} 기준 가능 슬롯/배정
          </p>
          <Link
            href={`/admin/statistics?week=${nextWeek}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            다음 주 →
          </Link>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">사용자</th>
                <th className="px-4 py-2 text-right">가능 슬롯(주)</th>
                <th className="px-4 py-2 text-right">배정 횟수(주)</th>
                <th className="px-4 py-2 text-right">배정률</th>
                <th className="px-4 py-2">최근 직감일</th>
                <th className="px-4 py-2 text-right">힘레븐1(누적)</th>
                <th className="px-4 py-2 text-right">힘레븐2(누적)</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const available = availableCountByUser.get(u.id) ?? 0;
                const assigned = weekAssignedCountByUser.get(u.id) ?? 0;
                const rate = available > 0 ? ((assigned / available) * 100).toFixed(1) + "%" : "-";
                return (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">
                      <Link href={`/admin/users/${u.id}`} className="hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">{available}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{assigned}</td>
                    <td className="px-4 py-2 text-right text-slate-600">{rate}</td>
                    <td className="px-4 py-2 text-slate-500">{lastDateByUser.get(u.id) ?? "-"}</td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {gym1CountByUser.get(u.id) ?? 0}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {gym2CountByUser.get(u.id) ?? 0}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    사용자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          누적 지표(최근 직감일, 힘레븐1/2)는 전체 기간 기준이며, 가능 슬롯/배정 횟수/배정률만 선택한 주 기준입니다.
        </p>
      </main>
    </div>
  );
}
