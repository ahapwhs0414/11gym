import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { MarkReadButton } from "@/components/notifications/mark-read-button";

const TYPE_LABEL: Record<string, string> = {
  ASSIGNMENT_RESULT: "배정 완료",
  EXCHANGE_REQUEST: "교환 요청",
  EXCHANGE_ACCEPTED: "교환 완료",
  NOTICE: "공지",
};

export default async function NotificationsPage() {
  const session = await requireUserSession();

  const notifications = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

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
          <h1 className="text-xl font-bold text-slate-900">알림</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈
          </Link>
        </div>

        <div className="space-y-2">
          {notifications.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              받은 알림이 없습니다.
            </p>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-4 ${
                n.readAt ? "border-slate-200 bg-white" : "border-teal-200 bg-teal-50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-teal-700">
                    {TYPE_LABEL[n.type] ?? n.type}
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{n.content}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {n.createdAt.toLocaleString("ko-KR")}
                  </p>
                </div>
                {!n.readAt && <MarkReadButton id={n.id} />}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
