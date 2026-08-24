import { requireAdminSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";
import { prisma } from "@/lib/prisma";

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();

  const [totalUsers, activeUsers] = await Promise.all([
    prisma.user.count({ where: { role: "USER" } }),
    prisma.user.count({ where: { role: "USER", status: "ACTIVE" } }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-sm font-semibold text-slate-900">
          관리자 대시보드
        </span>
        <LogoutButton redirectTo="/admin-login" />
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-bold text-slate-900">
          {session.name} 관리자님
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Phase 1: 프로젝트 뼈대 / DB 연결 / 로그인 / 권한 관리 완료
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">전체 사용자</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {totalUsers}명
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium text-slate-500">활성 사용자</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {activeUsers}명
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
          사용자 관리 · 투표 현황 · 배정 · 통계 등은
          <br />
          이후 Phase에서 이 화면에 채워집니다.
        </div>
      </main>
    </div>
  );
}
