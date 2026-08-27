import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { LateGraceForm } from "@/components/admin/late-grace-form";
import { getEarlyEndGraceMinutes, getLateGraceMinutes } from "@/lib/settings";

export default async function AdminSettingsPage() {
  await requireAdminSession();
  const [lateGraceMinutes, earlyEndGraceMinutes] = await Promise.all([
    getLateGraceMinutes(),
    getEarlyEndGraceMinutes(),
  ]);

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
          <p className="mb-1 text-sm font-semibold text-slate-900">출퇴근 판정 유예 시간</p>
          <p className="mb-3 text-xs text-slate-500">
            §44: 예정 시작 시간으로부터 지각 유예 시간을 초과해 직감을 시작하면 지각으로 기록합니다.
            §47: 예정 종료 시간으로부터 조기 종료 유예 시간보다 더 일찍 종료하면 조기 종료로
            기록합니다(유예 시간 이내로 일찍 끝내는 것은 정상 종료로 처리).
          </p>
          <LateGraceForm
            initialLateMinutes={lateGraceMinutes}
            initialEarlyEndMinutes={earlyEndGraceMinutes}
          />
        </section>
      </main>
    </div>
  );
}
