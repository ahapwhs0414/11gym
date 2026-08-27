import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { LateGraceForm } from "@/components/admin/late-grace-form";
import { getLateGraceMinutes } from "@/lib/settings";

export default async function AdminSettingsPage() {
  await requireAdminSession();
  const lateGraceMinutes = await getLateGraceMinutes();

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
          <h1 className="text-xl font-bold text-slate-900">시스템 설정</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-1 text-sm font-semibold text-slate-900">지각 판정 유예 시간</p>
          <p className="mb-3 text-xs text-slate-500">
            §44: 예정 시작 시간으로부터 이 시간(분)을 초과해 직감을 시작하면 지각으로 기록합니다.
          </p>
          <LateGraceForm initialMinutes={lateGraceMinutes} />
        </section>
      </main>
    </div>
  );
}
