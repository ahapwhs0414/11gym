import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";

export default async function NoticesPage() {
  await requireUserSession();

  const notices = await prisma.notice.findMany({ orderBy: { createdAt: "desc" } });

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
          <h1 className="text-xl font-bold text-slate-900">공지사항</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈
          </Link>
        </div>

        <div className="space-y-3">
          {notices.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              등록된 공지가 없습니다.
            </p>
          )}
          {notices.map((notice) => (
            <div key={notice.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              {notice.isImportant && (
                <span className="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  중요
                </span>
              )}
              <p className="font-semibold text-slate-900">{notice.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{notice.content}</p>
              <p className="mt-1 text-xs text-slate-400">
                {notice.createdAt.toLocaleString("ko-KR")}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
