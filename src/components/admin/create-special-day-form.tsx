"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateSpecialDayForm() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!date) {
      setError("날짜를 선택해주세요.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/special-days", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason: reason.trim() || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "등록에 실패했습니다.");
      return;
    }
    setDate("");
    setReason("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs font-medium text-slate-500">날짜</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <div className="flex-1">
        <label className="text-xs font-medium text-slate-500">사유 (선택)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="예: 한글날 공휴일"
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {loading ? "등록 중..." : "주말형으로 지정"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
