"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkAbsentButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/duty-logs/${assignmentId}/mark-absent`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "처리에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <span className="block">
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-[11px] font-medium text-red-600 underline disabled:opacity-60"
      >
        {loading ? "처리 중..." : "결석 처리"}
      </button>
      {error && <span className="block text-[10px] text-red-500">{error}</span>}
    </span>
  );
}
