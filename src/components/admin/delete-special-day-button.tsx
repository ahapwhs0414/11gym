"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteSpecialDayButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/admin/special-days/${id}`, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <button
        onClick={handleClick}
        disabled={loading}
        className="text-xs font-medium text-red-600 underline disabled:opacity-60"
      >
        {loading ? "삭제 중..." : "해제"}
      </button>
      {error && <span className="ml-2 text-xs text-red-500">{error}</span>}
    </span>
  );
}
