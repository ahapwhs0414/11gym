import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { UserMemoForm } from "@/components/admin/user-memo-form";
import { fetchMonthlyRows } from "@/lib/monthly-report";

const GYM_LABEL: Record<string, string> = { GYM1: "힘레븐1", GYM2: "힘레븐2", ANY: "상관없음" };

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const sp = await searchParams;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "USER") notFound();

  const now = new Date();
  const year = Number(sp.year) || now.getUTCFullYear();
  const month = Number(sp.month) || now.getUTCMonth() + 1;

  const rows = await fetchMonthlyRows({ year, month, userId: id });
  const dutyCount = rows.length;
  const normalCount = rows.filter((r) => r.dutyLogStatus !== "ABSENT" && r.startedAt && !r.startedLate).length;
  const lateCount = rows.filter((r) => r.startedLate).length;
  const absentCount = rows.filter((r) => r.dutyLogStatus === "ABSENT").length;
  const earlyCount = rows.filter((r) => r.endedEarly).length;
  const exchangeCount = rows.filter((r) => r.wasExchanged).length;
  const gym1Count = rows.filter((r) => r.gymName === "힘레븐1").length;
  const gym2Count = rows.filter((r) => r.gymName === "힘레븐2").length;

  const prevMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const monthQuery = (m: { year: number; month: number }) => `?year=${m.year}&month=${m.month}`;

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
          <h1 className="text-xl font-bold text-slate-900">{user.name}</h1>
          <Link href="/admin/users" className="text-sm text-teal-700 hover:underline">
            ← 사용자 관리
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap gap-4 text-sm">
            <p>
              <span className="text-slate-500">헬스장 선호</span>{" "}
              <span className="font-semibold text-slate-900">
                {GYM_LABEL[user.gymPreference] ?? user.gymPreference}
              </span>
            </p>
            <p>
              <span className="text-slate-500">상태</span>{" "}
              <span className="font-semibold text-slate-900">
                {user.status === "ACTIVE" ? "활성" : "비활성"}
              </span>
            </p>
            <p>
              <span className="text-slate-500">등록일</span>{" "}
              <span className="text-slate-700">{user.createdAt.toLocaleDateString("ko-KR")}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-slate-900">관리자 메모</p>
          <UserMemoForm userId={user.id} initialMemo={user.adminMemo ?? ""} />
        </div>

        <div className="mt-6 mb-3 flex items-center justify-between">
          <Link
            href={`/admin/users/${id}${monthQuery(prevMonth)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            ← 이전 달
          </Link>
          <p className="text-sm font-semibold text-slate-900">
            {year}년 {month}월 직감
          </p>
          <Link
            href={`/admin/users/${id}${monthQuery(nextMonth)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
          >
            다음 달 →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={`${month}월 직감`} value={`${dutyCount}회`} />
          <StatCard label="정상 출석" value={`${normalCount}회`} />
          <StatCard label="지각" value={`${lateCount}회`} />
          <StatCard label="결석" value={`${absentCount}회`} />
          <StatCard label="조기 종료" value={`${earlyCount}회`} />
          <StatCard label="교환" value={`${exchangeCount}회`} />
          <StatCard label="힘레븐1" value={`${gym1Count}회`} />
          <StatCard label="힘레븐2" value={`${gym2Count}회`} />
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">날짜</th>
                <th className="px-4 py-2">시간</th>
                <th className="px-4 py-2">헬스장</th>
                <th className="px-4 py-2">상태</th>
                <th className="px-4 py-2">문제/건의사항</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assignmentId} className="border-b border-slate-100">
                  <td className="px-4 py-2 text-slate-700">{r.date}</td>
                  <td className="px-4 py-2 text-slate-500">{r.startTime}</td>
                  <td className="px-4 py-2 text-slate-700">{r.gymName}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {r.dutyLogStatus === "ABSENT"
                      ? "결석"
                      : r.dutyLogStatus === "COMPLETED"
                        ? r.startedLate
                          ? "지각"
                          : r.endedEarly
                            ? "조기 종료"
                            : "완료"
                        : "예정"}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-2 text-slate-500" title={r.issueNote ?? undefined}>
                    {r.issueNote ?? "-"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    해당 월의 직감 기록이 없습니다.
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}
