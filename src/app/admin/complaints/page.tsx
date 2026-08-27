import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { ComplaintRow } from "@/components/admin/complaint-row";

const STATUS_FILTERS = [
  { value: "", label: "전체" },
  { value: "RECEIVED", label: "접수" },
  { value: "IN_REVIEW", label: "확인 중" },
  { value: "RESOLVED", label: "처리 완료" },
];

export default async function AdminComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;
  const status = sp.status ?? "";

  const complaints = await prisma.complaint.findMany({
    where: status ? { status: status as "RECEIVED" | "IN_REVIEW" | "RESOLVED" } : undefined,
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

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
          <h1 className="text-xl font-bold text-slate-900">의견 관리</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <div className="mb-4 flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/admin/complaints?status=${f.value}` : "/admin/complaints"}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                status === f.value
                  ? "bg-teal-700 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div className="space-y-3">
          {complaints.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              해당하는 의견이 없습니다.
            </p>
          )}
          {complaints.map((c) => (
            <ComplaintRow
              key={c.id}
              id={c.id}
              title={c.title}
              content={c.content}
              authorLabel={c.isAnonymous ? "익명" : c.user.name}
              status={c.status}
              adminReply={c.adminReply}
              createdAt={c.createdAt.toISOString()}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
