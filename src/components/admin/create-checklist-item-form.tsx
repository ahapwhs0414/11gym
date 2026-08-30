"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateChecklistItemForm({ dayOfWeek }: { dayOfWeek: number | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [required, setRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/checklist-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), required, dayOfWeek }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setName("");
    setRequired(true);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex-1">
        <label className="text-xs font-medium text-slate-500">항목 이름</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 기구 윤활하기"
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <label className="flex items-center gap-1.5 pb-2 text-xs font-medium text-slate-600">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 accent-teal-700"
        />
        필수
      </label>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "추가 중..." : "항목 추가"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
