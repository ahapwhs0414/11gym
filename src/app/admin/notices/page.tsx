import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateNoticeForm } from "@/components/admin/create-notice-form";
import { NoticeRow } from "@/components/admin/notice-row";

export default async function AdminNoticesPage() {
  await requireAdminSession();

  const notices = await prisma.notice.findMany({ orderBy: { createdAt: "desc" } });

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
          <h1 className="text-xl font-bold text-slate-900">공지 관리</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CreateNoticeForm />
        </section>

        <div className="mt-6 space-y-3">
          {notices.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              등록된 공지가 없습니다.
            </p>
          )}
          {notices.map((notice) => (
            <NoticeRow
              key={notice.id}
              id={notice.id}
              title={notice.title}
              content={notice.content}
              isImportant={notice.isImportant}
              createdAt={notice.createdAt.toISOString()}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
