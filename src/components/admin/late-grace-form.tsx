"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function LateGraceForm({ initialMinutes }: { initialMinutes: number }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(initialMinutes);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lateGraceMinutes: minutes }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장에 실패했습니다.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs font-medium text-slate-500">지각 유예 시간(분)</label>
        <input
          type="number"
          min={0}
          max={60}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="mt-1 block w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "저장 중..." : "저장"}
      </button>
      {saved && <span className="text-xs text-teal-700">저장되었습니다.</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
