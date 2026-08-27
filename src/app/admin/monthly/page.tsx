import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { DeleteAssignmentButton } from "@/components/admin/delete-assignment-button";
import {
  fetchMonthlyRows,
  computeMonthlyOverallStats,
  type AttendanceFilter,
} from "@/lib/monthly-report";

const ATTENDANCE_FILTERS: { value: AttendanceFilter | ""; label: string }[] = [
  { value: "", label: "전체" },
  { value: "NORMAL", label: "정상" },
  { value: "LATE", label: "지각" },
  { value: "ABSENT", label: "결석" },
  { value: "EARLY", label: "조기 종료" },
];

function attendanceLabel(row: { dutyLogStatus: string; startedAt: Date | null; startedLate: boolean }) {
  if (row.dutyLogStatus === "ABSENT") return "결석";
  if (!row.startedAt) return "-";
  return row.startedLate ? "지각" : "정상";
}

function endingLabel(row: { endedAt: Date | null; endedEarly: boolean }) {
  if (!row.endedAt) return "-";
  return row.endedEarly ? "조기" : "정상";
}

function statusLabel(status: string) {
  if (status === "COMPLETED") return "완료";
  if (status === "ABSENT") return "결석";
  return "예정";
}

export default async function AdminMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    userId?: string;
    gymId?: string;
    attendance?: string;
  }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getUTCFullYear();
  const month = Number(sp.month) || now.getUTCMonth() + 1;
  const userId = sp.userId ?? "";
  const gymId = sp.gymId ?? "";
  const attendance = (sp.attendance as AttendanceFilter | undefined) || undefined;

  const [rows, users, gyms] = await Promise.all([
    fetchMonthlyRows({ year, month, userId: userId || undefined, gymId: gymId || undefined, attendance }),
    prisma.user.findMany({ where: { role: "USER" }, orderBy: { name: "asc" } }),
    prisma.gym.findMany(),
  ]);
  const stats = computeMonthlyOverallStats(rows);

  function buildQuery(overrides: { year?: number; month?: number }) {
    const params = new URLSearchParams();
    params.set("year", String(overrides.year ?? year));
    params.set("month", String(overrides.month ?? month));
    if (userId) params.set("userId", userId);
    if (gymId) params.set("gymId", gymId);
    if (attendance) params.set("attendance", attendance);
    return params.toString();
  }

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">월간 직감 기록</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="mb-4 flex items-center justify-between">
          <Link
            href={`/admin/monthly?${buildQuery(prevMonth)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            ← 이전 달
          </Link>
          <p className="text-sm font-semibold text-slate-900">
            {year}년 {month}월
          </p>
          <Link
            href={`/admin/monthly?${buildQuery(nextMonth)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            다음 달 →
          </Link>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">전체 직감 횟수</p>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.totalCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">평균 / 최대 / 최소</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {stats.averageCount.toFixed(1)} / {stats.maxCount} / {stats.minCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">지각 / 결석 / 조기종료</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {stats.lateCount} / {stats.absentCount} / {stats.earlyCount}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">교환 / 힘레븐1 / 힘레븐2</p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {stats.exchangeCount} / {stats.gym1Count} / {stats.gym2Count}
            </p>
          </div>
        </div>

        <form className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-4">
          <input type="hidden" name="year" value={year} />
          <input type="hidden" name="month" value={month} />
          <div>
            <label className="text-xs font-medium text-slate-500">사용자</label>
            <select
              name="userId"
              defaultValue={userId}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="">전체</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">헬스장</label>
            <select
              name="gymId"
              defaultValue={gymId}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="">전체</option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">출석 상태</label>
            <select
              name="attendance"
              defaultValue={attendance ?? ""}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              {ATTENDANCE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            필터 적용
          </button>
          <a
            href={`/api/admin/monthly/export?${buildQuery({})}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
          >
            CSV 다운로드
          </a>
        </form>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">날짜</th>
                <th className="px-4 py-2">시간</th>
                <th className="px-4 py-2">헬스장</th>
                <th className="px-4 py-2">직감자</th>
                <th className="px-4 py-2">출석</th>
                <th className="px-4 py-2">종료</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2">교환</th>
                <th className="px-4 py-2">문제/건의사항</th>
                <th className="px-4 py-2">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assignmentId} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{r.date}</td>
                  <td className="px-4 py-2 text-slate-500">{r.startTime}</td>
                  <td className="px-4 py-2 text-slate-700">{r.gymName}</td>
                  <td className="px-4 py-2 text-slate-900">
                    <Link href={`/admin/users/${r.userId}`} className="hover:underline">
                      {r.userName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{attendanceLabel(r)}</td>
                  <td className="px-4 py-2 text-slate-500">{endingLabel(r)}</td>
                  <td className="px-4 py-2 text-slate-500">{statusLabel(r.dutyLogStatus)}</td>
                  <td className="px-4 py-2 text-slate-500">{r.wasExchanged ? "예" : "-"}</td>
                  <td className="max-w-[220px] truncate px-4 py-2 text-slate-500" title={r.issueNote ?? undefined}>
                    {r.issueNote ?? "-"}
                  </td>
                  <td className="px-4 py-2">
                    <DeleteAssignmentButton assignmentId={r.assignmentId} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                    해당 조건의 기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
