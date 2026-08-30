import Link from "next/link";
import { requireAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "@/components/logout-button";
import { CreateChecklistItemForm } from "@/components/admin/create-checklist-item-form";
import { ChecklistItemRow } from "@/components/admin/checklist-item-row";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function parseScope(scope: string | undefined): number | null {
  if (scope && /^[0-6]$/.test(scope)) return Number(scope);
  return null;
}

export default async function AdminChecklistPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  await requireAdminSession();
  const sp = await searchParams;
  const isCommonTab = !sp.scope || sp.scope === "common";
  const dayOfWeek = isCommonTab ? null : parseScope(sp.scope);

  const items = await prisma.checklistItem.findMany({
    where: { active: true, dayOfWeek },
    orderBy: { sortOrder: "asc" },
  });

  const tabs: { key: string; label: string }[] = [
    { key: "common", label: "모든 요일 공통" },
    ...DAY_LABELS.map((label, i) => ({ key: String(i), label: `${label}요일` })),
  ];
  const activeKey = isCommonTab ? "common" : String(dayOfWeek);

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
          직감 종료 전 확인해야 하는 업무 체크리스트를 관리합니다. &quot;모든 요일 공통&quot; 항목은
          매일 적용되고, 특정 요일 탭에 추가한 항목은 그 요일에만 추가로 적용됩니다.
        </p>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={`/admin/checklist?scope=${tab.key}`}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeKey === tab.key
                  ? "bg-teal-700 text-white"
                  : "border border-slate-300 text-slate-600"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <CreateChecklistItemForm dayOfWeek={dayOfWeek} />
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
