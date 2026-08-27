"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NoticeRow({
  id,
  title,
  content,
  isImportant,
  createdAt,
}: {
  id: string;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggleImportant() {
    setLoading(true);
    await fetch(`/api/admin/notices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isImportant: !isImportant }),
    });
    setLoading(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    setLoading(true);
    await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          {isImportant && (
            <span className="mb-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              중요
            </span>
          )}
          <p className="font-semibold text-slate-900">{title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{content}</p>
          <p className="mt-1 text-xs text-slate-400">
            {new Date(createdAt).toLocaleString("ko-KR")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={toggleImportant}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
        >
          {isImportant ? "중요 해제" : "중요로 표시"}
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60"
        >
          삭제
        </button>
      </div>
    </div>
  );
}
