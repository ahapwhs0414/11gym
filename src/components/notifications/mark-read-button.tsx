"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
    >
      읽음
    </button>
  );
}
