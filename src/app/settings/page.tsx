import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { GymPreferenceForm } from "@/components/settings/gym-preference-form";
import { PinChangeForm } from "@/components/settings/pin-change-form";

export default async function SettingsPage() {
  const session = await requireUserSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });

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
          <h1 className="text-xl font-bold text-slate-900">설정</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈으로
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">헬스장 선호도</h2>
          <p className="mt-1 text-xs text-slate-500">
            변경 사항은 다음 자동 배정부터 적용됩니다. 이미 확정된 배정에는 영향을 주지
            않습니다.
          </p>
          <GymPreferenceForm initialValue={user.gymPreference} />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">PIN 변경</h2>
          <PinChangeForm />
        </section>
      </main>
    </div>
  );
}
