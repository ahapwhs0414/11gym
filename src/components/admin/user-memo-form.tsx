"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserMemoForm({ userId, initialMemo }: { userId: string; initialMemo: string }) {
  const router = useRouter();
  const [memo, setMemo] = useState(initialMemo);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setLoading(true);
    setSaved(false);
    await fetch(`/api/admin/users/${userId}/memo`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    });
    setLoading(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="관리자만 볼 수 있는 메모입니다."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-teal-800 disabled:opacity-60"
        >
          메모 저장
        </button>
        {saved && <span className="text-xs text-teal-700">저장되었습니다.</span>}
      </div>
    </div>
  );
}
