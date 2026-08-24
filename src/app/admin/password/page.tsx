import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { AdminPasswordForm } from "@/components/admin/admin-password-form";

export default async function AdminPasswordPage() {
  await requireAdminSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <Link href="/admin/dashboard" className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </Link>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">비밀번호 변경</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <AdminPasswordForm />
        </section>
      </main>
    </div>
  );
}
