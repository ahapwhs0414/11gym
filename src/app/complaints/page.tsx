import Link from "next/link";
import { requireUserSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateComplaintForm } from "@/components/complaints/create-complaint-form";

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "접수",
  IN_REVIEW: "확인 중",
  RESOLVED: "처리 완료",
};

export default async function ComplaintsPage() {
  const session = await requireUserSession();

  const complaints = await prisma.complaint.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
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
          <h1 className="text-xl font-bold text-slate-900">의견 제시</h1>
          <Link href="/home" className="text-sm text-teal-700 hover:underline">
            ← 홈
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CreateComplaintForm />
        </section>

        <div className="mt-6 space-y-3">
          {complaints.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              제출한 의견이 없습니다.
            </p>
          )}
          {complaints.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-900">{c.title}</p>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{c.content}</p>
              <p className="mt-1 text-xs text-slate-400">
                {c.createdAt.toLocaleString("ko-KR")}
                {c.isAnonymous && " · 익명"}
              </p>
              {c.adminReply && (
                <div className="mt-2 rounded-lg bg-teal-50 p-3">
                  <p className="text-xs font-semibold text-teal-700">관리자 답변</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-teal-900">{c.adminReply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
