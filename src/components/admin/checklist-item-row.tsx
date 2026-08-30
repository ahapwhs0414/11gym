"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChecklistItemRow({
  id,
  name,
  required,
}: {
  id: string;
  name: string;
  required: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/checklist-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "저장에 실패했습니다.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function handleSaveName() {
    if (!nameValue.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    const ok = await patch({ name: nameValue.trim() });
    if (ok) setEditing(false);
  }

  async function handleToggleRequired() {
    await patch({ required: !required });
  }

  async function handleDelete() {
    if (!confirm(`"${name}" 항목을 목록에서 제거할까요?`)) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/checklist-items/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        {editing ? (
          <input
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            maxLength={100}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          />
        ) : (
          <p className="min-w-0 flex-1 truncate text-slate-900">{name}</p>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <button
                onClick={handleSaveName}
                disabled={loading}
                className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
              >
                저장
              </button>
              <button
                onClick={() => {
                  setNameValue(name);
                  setEditing(false);
                }}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500"
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleToggleRequired}
                disabled={loading}
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  required ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
                }`}
                title="클릭해서 필수/선택 전환"
              >
                {required ? "필수" : "선택"}
              </button>
              <button
                onClick={() => setEditing(true)}
                disabled={loading}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100"
              >
                수정
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
