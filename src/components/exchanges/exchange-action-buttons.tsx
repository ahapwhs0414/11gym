"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExchangeActionButtons({
  exchangeId,
  action,
  label,
  variant = "primary",
}: {
  exchangeId: string;
  action: "accept" | "reject" | "cancel";
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/exchanges/${exchangeId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "처리에 실패했습니다.");
        setLoading(false);
        return;
      }
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
          variant === "primary"
            ? "bg-teal-700 text-white hover:bg-teal-800"
            : "border border-slate-300 text-slate-600 hover:bg-slate-100"
        }`}
      >
        {loading ? "처리 중..." : label}
      </button>
      {error && <span className="text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
