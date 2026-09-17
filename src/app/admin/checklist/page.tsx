import Link from "next/link";
import type { ChecklistScheduleType } from "@prisma/client";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateChecklistItemForm } from "@/components/admin/create-checklist-item-form";
import { ChecklistItemRow } from "@/components/admin/checklist-item-row";

type ChecklistScope = {
  key: string;
  label: string;
  scheduleType: ChecklistScheduleType | null;
  dayOfWeek: number | null;
  slotNumber: number | null;
};

const SCOPES: ChecklistScope[] = [
  { key: "common", label: "모든 일정 공통", scheduleType: null, dayOfWeek: null, slotNumber: null },
  { key: "weekday-1", label: "월요일", scheduleType: "REGULAR", dayOfWeek: 1, slotNumber: null },
  { key: "weekday-2", label: "화요일", scheduleType: "REGULAR", dayOfWeek: 2, slotNumber: null },
  { key: "weekday-3", label: "수요일", scheduleType: "REGULAR", dayOfWeek: 3, slotNumber: null },
  { key: "weekday-4", label: "목요일", scheduleType: "REGULAR", dayOfWeek: 4, slotNumber: null },
  { key: "weekday-5", label: "금요일", scheduleType: "REGULAR", dayOfWeek: 5, slotNumber: null },
  { key: "weekend-1", label: "주말 1타임", scheduleType: "WEEKEND", dayOfWeek: null, slotNumber: 1 },
  { key: "weekend-2", label: "주말 2타임", scheduleType: "WEEKEND", dayOfWeek: null, slotNumber: 2 },
  { key: "weekend-3", label: "주말 3타임", scheduleType: "WEEKEND", dayOfWeek: null, slotNumber: 3 },
  { key: "special-1", label: "특별일정 1타임", scheduleType: "SPECIAL", dayOfWeek: null, slotNumber: 1 },
  { key: "special-2", label: "특별일정 2타임", scheduleType: "SPECIAL", dayOfWeek: null, slotNumber: 2 },
  { key: "special-3", label: "특별일정 3타임", scheduleType: "SPECIAL", dayOfWeek: null, slotNumber: 3 },
];

export default async function AdminChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;
  const scope = SCOPES.find((item) => item.key === sp.scope) ?? SCOPES[0];

  const items = await prisma.checklistItem.findMany({
    where: {
      active: true,
      scheduleType: scope.scheduleType,
      dayOfWeek: scope.dayOfWeek,
      slotNumber: scope.slotNumber,
    },
    orderBy: { sortOrder: "asc" },
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
          <h1 className="text-xl font-bold text-slate-900">체크리스트 관리</h1>
          <Link href="/admin/dashboard" className="text-sm text-teal-700 hover:underline">
            ← 대시보드
          </Link>
        </div>

        <p className="mb-4 text-sm text-slate-500">
          공통 항목은 모든 직감에 적용됩니다. 주말과 특별일정은 1·2·3타임별로 서로 다른
          체크리스트를 설정할 수 있습니다.
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {SCOPES.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin/checklist?scope=${tab.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                scope.key === tab.key
                  ? "bg-teal-700 text-white"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CreateChecklistItemForm
            scheduleType={scope.scheduleType}
            dayOfWeek={scope.dayOfWeek}
            slotNumber={scope.slotNumber}
          />
        </section>

        <section className="mt-4 space-y-2">
          {items.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
              등록된 체크리스트 항목이 없습니다.
            </p>
          )}
          {items.map((item) => (
            <ChecklistItemRow key={item.id} id={item.id} name={item.name} required={item.required} />
          ))}
        </section>
      </main>
    </div>
  );
}
