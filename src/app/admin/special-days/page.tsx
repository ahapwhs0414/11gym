import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateSpecialDayForm } from "@/components/admin/create-special-day-form";
import { DeleteSpecialDayButton } from "@/components/admin/delete-special-day-button";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateLabel(date: Date) {
  return `${date.getUTCFullYear()}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일(${DAY_LABELS[date.getUTCDay()]})`;
}

export default async function AdminSpecialDaysPage() {
  await requireAdminSession();

  const todayStart = new Date(new Date().toISOString().slice(0, 10));
  const days = await prisma.specialScheduleDay.findMany({
    where: { date: { gte: todayStart } },
    orderBy: { date: "asc" },
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
          <h1 className="text-xl font-bold text-slate-900">주말형 일정 관리</h1>
          <Link href="/admin/schedule" className="text-sm text-teal-700 hover:underline">
            ← 전체 일정
          </Link>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          공휴일 등으로 평일에도 주말과 동일한 3타임(10:30~12:30, 15:00~17:00, 19:30~21:30)이 필요한
          날짜를 지정합니다. 이미 생성된 슬롯은 지정/해제와 무관하게 유지됩니다.
        </p>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CreateSpecialDayForm />
        </section>

        <section className="mt-6 space-y-2">
          {days.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              지정된 주말형 일정이 없습니다.
            </p>
          )}
          {days.map((day) => (
            <div
              key={day.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-sm"
            >
              <div>
                <p className="font-semibold text-slate-900">{formatDateLabel(day.date)}</p>
                {day.reason && <p className="text-slate-500">{day.reason}</p>}
              </div>
              <DeleteSpecialDayButton id={day.id} />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
