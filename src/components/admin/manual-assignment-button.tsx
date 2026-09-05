"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = {
  id: string;
  name: string;
};

export function ManualAssignmentButton({
  dutySlotId,
  gymId,
  gymName,
  users,
}: {
  dutySlotId: string;
  gymId: string;
  gymName: string;
  users: UserOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAssign() {
    if (!userId) {
      setError("배정할 사용자를 선택해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/assignments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dutySlotId, userId, gymId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "배정에 실패했습니다.");
        setLoading(false);
        return;
      }

      setOpen(false);
      setUserId("");
      setLoading(false);
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
      >
        미배정 → 배정
      </button>
    );
  }

  return (
    <div className="min-w-[170px] space-y-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <p className="text-[11px] font-semibold text-slate-700">{gymName} 직감자 배정</p>
      <select
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        disabled={loading}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs"
      >
        <option value="">사용자 선택</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={handleAssign}
          disabled={loading}
          className="flex-1 rounded-md bg-teal-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {loading ? "배정 중..." : "배정하기"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={loading}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-[11px] text-slate-600"
        >
          취소
        </button>
      </div>
    </div>
  );
}
