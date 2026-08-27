import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";

const PAGE_SIZE = 50;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ targetType?: string; page?: string }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;
  const targetType = sp.targetType ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where = targetType ? { targetType } : undefined;

  const [logs, total, targetTypes, actors] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["targetType"], select: { targetType: true } }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const actorNameById = new Map(actors.map((a) => [a.id, a.name]));
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          <h1 className="text-xl font-bold text-slate-900">감사 로그</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/admin/audit-logs"
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              !targetType
                ? "bg-teal-700 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            전체
          </Link>
          {targetTypes.map((t) => (
            <Link
              key={t.targetType}
              href={`/admin/audit-logs?targetType=${t.targetType}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                targetType === t.targetType
                  ? "bg-teal-700 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.targetType}
            </Link>
          ))}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2">시각</th>
                <th className="px-4 py-2">실행자</th>
                <th className="px-4 py-2">동작</th>
                <th className="px-4 py-2">대상</th>
                <th className="px-4 py-2">사유</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                    {log.createdAt.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {actorNameById.get(log.actorId) ?? log.actorId}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-900">{log.action}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {log.targetType} · {log.targetId}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{log.reason ?? "-"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link
                href={`/admin/audit-logs?${targetType ? `targetType=${targetType}&` : ""}page=${page - 1}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
              >
                이전
              </Link>
            )}
            <span className="text-sm text-slate-500">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/admin/audit-logs?${targetType ? `targetType=${targetType}&` : ""}page=${page + 1}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600"
              >
                다음
              </Link>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
