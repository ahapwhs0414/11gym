import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { UserRow } from "@/components/admin/user-row";

export default async function AdminUsersPage() {
  await requireAdminSession();

  const users = await prisma.user.findMany({
    where: { role: "USER" },
    orderBy: { createdAt: "asc" },
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
          <h1 className="text-xl font-bold text-slate-900">사용자 관리</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <CreateUserForm />

        <div className="mt-8 space-y-3">
          {users.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              등록된 사용자가 없습니다.
            </p>
          )}
          {users.map((user) => (
            <UserRow
              key={user.id}
              id={user.id}
              name={user.name}
              status={user.status}
              gymPreference={user.gymPreference}
              createdAt={user.createdAt.toISOString()}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
