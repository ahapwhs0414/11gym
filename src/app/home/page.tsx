import { requireUserSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function UserHomePage() {
  const session = await requireUserSession();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          직감 관리 시스템
        </span>
        <LogoutButton redirectTo="/login" />
      </header>

      <main className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900">
          {session.name}님, 안녕하세요
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Phase 1: 로그인/권한 기반이 구축되었습니다.
        </p>

        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
          다음 직감 · 전체 일정 · 투표 · 교환 등은
          <br />
          이후 Phase에서 이 화면에 채워집니다.
        </div>
      </main>
    </div>
  );
}
